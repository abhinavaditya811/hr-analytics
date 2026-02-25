import re
import pandas as pd
import numpy as np
from collections import Counter
from itertools import combinations

# CONFIG
CSV_PATH = "./data/raw/mockup_awards.csv"
COL_AWARD = "award_title"
COL_RECIP = "recipient_title"
COL_NOM = "nominator_title"
COL_MSG = "message"


def load_data():
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} award records\n")
    return df

# METHOD 1: Unique Job Titles (Lower Bound)
def method_title_counting(df):
    """
    Count unique job titles across recipients and nominators.

    Limitation: Two people can share the same title ("Senior Engineer").
    So this is a LOWER BOUND — the true count is ≥ this number.
    """
    print("=" * 70)
    print("METHOD 1: Unique Job Title Counting")
    print("=" * 70)

    recip_titles = set(df[COL_RECIP].dropna().str.strip())
    nom_titles = set(df[COL_NOM].dropna().str.strip())

    all_titles = recip_titles | nom_titles
    only_recip = recip_titles - nom_titles
    only_nom = nom_titles - recip_titles
    both = recip_titles & nom_titles

    print(f"  Unique recipient titles:  {len(recip_titles)}")
    print(f"  Unique nominator titles:  {len(nom_titles)}")
    print(f"  Titles appearing as both: {len(both)}")
    print(f"  Only recipient:           {len(only_recip)}")
    print(f"  Only nominator:           {len(only_nom)}")
    print(f"  Total unique titles:      {len(all_titles)}")

    # Title frequency — how many awards per title?
    recip_freq = df[COL_RECIP].value_counts()
    nom_freq = df[COL_NOM].value_counts()

    print(f"\n  Recipient title frequency (top 10):")
    for title, count in recip_freq.head(10).items():
        print(f"    {count:3d}x  {title}")

    print(f"\n  Nominator title frequency (top 10):")
    for title, count in nom_freq.head(10).items():
        print(f"    {count:3d}x  {title}")

    # Estimate: if a title appears N times, there could be 1 person or N people
    # Conservative: 1 person per title. Liberal: assume high-freq titles have multiple holders
    print(f"\n  ► Lower bound (1 person per unique title): {len(all_titles)}")

    return {
        "unique_recipient_titles": len(recip_titles),
        "unique_nominator_titles": len(nom_titles),
        "total_unique_titles": len(all_titles),
        "overlap_titles": len(both),
        "lower_bound": len(all_titles),
        "recip_freq": recip_freq,
        "nom_freq": nom_freq,
    }


# METHOD 2: Named Entity Extraction (Regex-based)
def method_name_extraction(df):
    """
    Extract first names mentioned in award messages.

    Many messages say things like "Carrie, Eva, & Liu, thank you..."
    or "A big thank you to James, Liu, and Matt!"

    This captures people BEYOND just the recipient/nominator pair,
    revealing the broader employee population touched by recognition.
    """
    print("\n" + "=" * 70)
    print("METHOD 2: Named Entity Extraction from Messages")
    print("=" * 70)

    # Pattern: capitalized words that look like first names
    # Heuristic: appears after greeting-like contexts or in comma-separated lists
    # We exclude common non-name capitalized words
    exclude_words = {
        "Thank", "Thanks", "The", "This", "That", "These", "Those",
        "Your", "You", "Our", "We", "Yes", "And", "For", "But",
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
        "Team", "Well", "Over", "Cheers", "Here", "Last", "As",
        "With", "From", "What", "When", "Where", "How", "Why",
        "Workhuman", "WHL", "YouTube", "NPS", "POD", "ABM", "Davos",
        "Dublin", "EMEA", "Cisco", "Delaware", "Everest", "Jira",
        "Looking", "Enjoy", "Happy", "Great", "Amazing", "Incredible",
        "Really", "Always", "Every", "Creative", "Senior", "Director",
        "Manager", "VP", "Chief", "Lead", "Junior", "Principal",
        "Not", "I'm", "It's", "I've", "She", "His", "Her", "He",
        "Any", "All", "Some", "Each", "Would", "Could", "Should",
    }

    # Pattern: Capitalized word that's 2-12 chars, likely a first name
    name_pattern = re.compile(r"\b([A-Z][a-z]{1,11})\b")

    all_names = []
    names_per_msg = []

    for _, row in df.iterrows():
        msg = str(row[COL_MSG])
        candidates = name_pattern.findall(msg)
        names = [n for n in candidates if n not in exclude_words]
        all_names.extend(names)
        names_per_msg.append(len(names))

    name_counts = Counter(all_names)
    df_copy = df.copy()
    df_copy["names_mentioned"] = names_per_msg

    print(f"  Total name mentions found:  {sum(name_counts.values())}")
    print(f"  Unique names extracted:     {len(name_counts)}")
    print(f"  Avg names per message:      {np.mean(names_per_msg):.1f}")
    print(f"  Messages with 0 names:      {names_per_msg.count(0)}")
    print(f"  Messages with 3+ names:     {sum(1 for n in names_per_msg if n >= 3)}")

    print(f"\n  Most frequent names (top 20):")
    for name, count in name_counts.most_common(20):
        print(f"    {count:3d}x  {name}")

    # Group recognition detection
    group_msgs = sum(1 for n in names_per_msg if n >= 2)
    individual_msgs = sum(1 for n in names_per_msg if n == 1)
    print(f"\n  Individual recognition (1 name):    {individual_msgs}")
    print(f"  Group recognition (2+ names):       {group_msgs}")
    print(f"  No names detected:                  {names_per_msg.count(0)}")

    print(f"\n  ► Unique named individuals: {len(name_counts)}")
    print(f"    (Note: first-name only, so 'Matt' in two messages")
    print(f"     might be 1 person or 2 — this is approximate)")

    return {
        "unique_names": len(name_counts),
        "total_mentions": sum(name_counts.values()),
        "name_counts": name_counts,
        "group_recognition_msgs": group_msgs,
        "individual_recognition_msgs": individual_msgs,
        "names_per_message": names_per_msg,
    }


# METHOD 3: Capture-Recapture (Chapman Estimator)
def method_capture_recapture(df):
    """
    Treat recipients and nominators as two independent "captures"
    of the employee population.

    Chapman estimator (bias-corrected Lincoln-Petersen):
      N̂ = ((n1 + 1)(n2 + 1) / (m + 1)) - 1

    Where:
      n1 = unique individuals in sample 1 (recipient titles)
      n2 = unique individuals in sample 2 (nominator titles)
      m  = individuals appearing in BOTH samples

    Assumptions:
      - Population is "closed" (no one joins/leaves during data period)
      - Every individual has equal probability of being captured
      - The two captures are independent

    These assumptions are imperfect but give a useful upper estimate.
    """
    print("\n" + "=" * 70)
    print("METHOD 3: Capture-Recapture Estimation (Chapman)")
    print("=" * 70)

    recip_titles = set(df[COL_RECIP].dropna().str.strip())
    nom_titles = set(df[COL_NOM].dropna().str.strip())

    n1 = len(recip_titles)   # "captured" as recipients
    n2 = len(nom_titles)     # "captured" as nominators
    m = len(recip_titles & nom_titles)  # recaptured in both

    if m == 0:
        print("  ⚠ No overlap between recipient and nominator titles!")
        print("    Cannot apply capture-recapture.")
        return {"estimate": None, "reason": "no overlap"}

    # Chapman estimator
    n_hat = ((n1 + 1) * (n2 + 1) / (m + 1)) - 1

    # Variance (Chapman)
    var = ((n1 + 1) * (n2 + 1) * (n1 - m) * (n2 - m)) / ((m + 1)**2 * (m + 2))
    se = np.sqrt(var)

    # 95% confidence interval
    ci_low = max(n_hat - 1.96 * se, max(n1, n2))  # can't be less than observed
    ci_high = n_hat + 1.96 * se

    print(f"  Recipients (n1):           {n1}")
    print(f"  Nominators (n2):           {n2}")
    print(f"  Overlap (m):               {m}")
    print(f"  Overlap ratio:             {m/min(n1,n2)*100:.1f}% of smaller set")
    print(f"\n  Chapman estimate (N̂):      {n_hat:.0f}")
    print(f"  Standard error:            {se:.0f}")
    print(f"  95% CI:                    [{ci_low:.0f}, {ci_high:.0f}]")

    # Sensitivity: what if some titles have multiple holders?
    # If on average each title maps to k people, multiply N̂ by k
    print(f"\n  Sensitivity analysis (if avg people per title = k):")
    for k in [1.0, 1.5, 2.0, 2.5]:
        print(f"    k={k:.1f} → estimated population: {n_hat * k:.0f}")

    return {
        "n1": n1, "n2": n2, "overlap": m,
        "estimate": round(n_hat),
        "se": round(se),
        "ci_95": (round(ci_low), round(ci_high)),
    }


# METHOD 4: Interaction Network Analysis
def method_network_analysis(df):
    """
    Analyze the directed recognition graph:
      - Each unique (nominator_title → recipient_title) is an edge
      - Nodes are unique titles
      - Network properties reveal organizational structure

    Metrics:
      - Unique interaction pairs (edges)
      - In-degree: how many different people recognized this title
      - Out-degree: how many different people this title recognized
      - Connected components: clusters of mutual recognition
    """
    print("\n" + "=" * 70)
    print("METHOD 4: Interaction Network Analysis")
    print("=" * 70)

    # Build edge list
    edges = df[[COL_NOM, COL_RECIP]].dropna()
    edges.columns = ["source", "target"]
    edges["source"] = edges["source"].str.strip()
    edges["target"] = edges["target"].str.strip()

    unique_edges = edges.drop_duplicates()
    all_nodes = set(edges["source"]) | set(edges["target"])

    print(f"  Total award records:       {len(edges)}")
    print(f"  Unique interaction pairs:  {len(unique_edges)}")
    print(f"  Unique nodes (titles):     {len(all_nodes)}")
    print(f"  Density:                   {len(unique_edges) / (len(all_nodes)**2) * 100:.2f}%")

    # Degree analysis
    in_deg = edges["target"].value_counts()
    out_deg = edges["source"].value_counts()

    print(f"\n  Most recognized (in-degree, top 10):")
    for title, count in in_deg.head(10).items():
        print(f"    {count:3d} awards ← {title}")

    print(f"\n  Most active recognizers (out-degree, top 10):")
    for title, count in out_deg.head(10).items():
        print(f"    {count:3d} awards → {title}")

    # Self-recognition (same title nominating and receiving)
    self_loops = edges[edges["source"] == edges["target"]]
    print(f"\n  Same-title recognition:    {len(self_loops)} records")
    print(f"    (e.g., 'Director, Creative' recognizing 'Director, Creative')")
    print(f"    Could be: same person, or multiple people with same title")

    # Reciprocal pairs
    edge_set = set(zip(unique_edges["source"], unique_edges["target"]))
    reciprocal = [(a, b) for a, b in edge_set if (b, a) in edge_set]
    print(f"\n  Reciprocal pairs:          {len(reciprocal) // 2}")
    print(f"    (A recognized B AND B recognized A)")

    # Estimate multiplicity from repeated pairs
    pair_counts = edges.groupby(["source", "target"]).size()
    repeat_pairs = pair_counts[pair_counts > 1]
    print(f"\n  Pairs with repeated awards: {len(repeat_pairs)}")
    if len(repeat_pairs) > 0:
        print(f"  Max repeats for one pair:   {pair_counts.max()}")
        print(f"  Avg repeats (repeated only): {repeat_pairs.mean():.1f}")

    return {
        "total_edges": len(edges),
        "unique_pairs": len(unique_edges),
        "unique_nodes": len(all_nodes),
        "in_degree": in_deg,
        "out_degree": out_deg,
        "self_loops": len(self_loops),
        "reciprocal_pairs": len(reciprocal) // 2,
    }


# SYNTHESIS: Combine All Estimates
def synthesize(title_results, name_results, cr_results, network_results):
    """Pull all methods together into a final estimate range."""
    print("\n" + "=" * 70)
    print("SYNTHESIS: Employee Population Estimate")
    print("=" * 70)

    print(f"\n  Method 1 (Unique titles):         {title_results['total_unique_titles']} titles")
    print(f"  Method 2 (Named individuals):     {name_results['unique_names']} names")
    if cr_results.get("estimate"):
        print(f"  Method 3 (Capture-recapture):     {cr_results['estimate']} (95% CI: {cr_results['ci_95']})")
    print(f"  Method 4 (Network nodes):         {network_results['unique_nodes']} nodes")

    # Key insight: titles ≠ people
    # If title X appears as recipient 15 times, is it 1 person or 15?
    # Use the name extraction as a calibration signal
    title_count = title_results["total_unique_titles"]
    name_count = name_results["unique_names"]

    print(f"\n  ─── Reasoning ───")
    print(f"  Unique titles give us a LOWER BOUND:    ~{title_count}")
    print(f"  Names in messages give an INDEPENDENT signal: ~{name_count} unique first names")

    if cr_results.get("estimate"):
        cr_est = cr_results["estimate"]
        ci_low, ci_high = cr_results["ci_95"]

        # Recommended persona count: use capture-recapture central estimate
        # with name count as a sanity check
        recommended_low = max(title_count, ci_low)
        recommended_high = ci_high
        recommended_mid = cr_est

        print(f"  Capture-recapture estimate:              ~{cr_est}")
        print(f"\n  ═══ RECOMMENDED PERSONA RANGE ═══")
        print(f"  Low:    {recommended_low:.0f}  (conservative, ≈ unique titles)")
        print(f"  Mid:    {recommended_mid:.0f}  (capture-recapture central estimate)")
        print(f"  High:   {recommended_high:.0f}  (capture-recapture upper 95% CI)")
        print(f"\n  For your synthetic ecosystem, target: ~{recommended_mid:.0f} personas")
    else:
        print(f"\n  Without capture-recapture, use title count as baseline:")
        print(f"  Recommended range: {title_count} – {int(title_count * 1.5)}")

    # Participation rate estimate
    print(f"\n  ─── Participation Rate ───")
    print(f"  1000 awards across the estimated population gives:")
    for est_label, est in [("low", title_count), ("mid", cr_results.get("estimate", title_count))]:
        if est:
            rate = 1000 / est
            print(f"    {est_label}: {rate:.1f} awards per person (as nominator + recipient combined)")

def build_export(title_results, name_results, cr_results, network_results):
    """
    Build a JSON-serializable dict from all method results.
    Converts pandas objects (Series, Counters) to plain dicts/lists.
    """
    # Title frequency top 20
    recip_freq = title_results["recip_freq"].head(20).to_dict()
    nom_freq = title_results["nom_freq"].head(20).to_dict()

    # Name counts top 30
    top_names = dict(name_results["name_counts"].most_common(30))

    # In/out degree top 20
    in_deg = network_results["in_degree"].head(20).to_dict()
    out_deg = network_results["out_degree"].head(20).to_dict()

    # Compute recommended range
    title_count = title_results["total_unique_titles"]
    cr_est = cr_results.get("estimate")
    ci = cr_results.get("ci_95")

    if cr_est and ci:
        rec = {
            "low": max(title_count, ci[0]),
            "mid": cr_est,
            "high": ci[1],
            "method": "capture-recapture with title floor",
        }
    else:
        rec = {
            "low": title_count,
            "mid": int(title_count * 1.25),
            "high": int(title_count * 1.5),
            "method": "title count with heuristic multiplier (no capture-recapture)",
        }

    return {
        "metadata": {
            "source_file": CSV_PATH,
            "total_records": int(len(pd.read_csv(CSV_PATH))),
        },
        "method_1_title_counting": {
            "unique_recipient_titles": title_results["unique_recipient_titles"],
            "unique_nominator_titles": title_results["unique_nominator_titles"],
            "total_unique_titles": title_results["total_unique_titles"],
            "overlap_titles": title_results["overlap_titles"],
            "lower_bound": title_results["lower_bound"],
            "top_recipient_titles": recip_freq,
            "top_nominator_titles": nom_freq,
        },
        "method_2_name_extraction": {
            "unique_names": name_results["unique_names"],
            "total_mentions": name_results["total_mentions"],
            "group_recognition_messages": name_results["group_recognition_msgs"],
            "individual_recognition_messages": name_results["individual_recognition_msgs"],
            "no_names_detected": name_results["names_per_message"].count(0),
            "avg_names_per_message": round(np.mean(name_results["names_per_message"]), 2),
            "top_names": top_names,
        },
        "method_3_capture_recapture": {
            "recipients_n1": cr_results.get("n1"),
            "nominators_n2": cr_results.get("n2"),
            "overlap_m": cr_results.get("overlap"),
            "chapman_estimate": cr_results.get("estimate"),
            "standard_error": cr_results.get("se"),
            "ci_95": cr_results.get("ci_95"),
            "sensitivity": {
                f"k_{k}": round(cr_est * k) if cr_est else None
                for k in [1.0, 1.5, 2.0, 2.5]
            },
        },
        "method_4_network_analysis": {
            "total_edges": network_results["total_edges"],
            "unique_interaction_pairs": network_results["unique_pairs"],
            "unique_nodes": network_results["unique_nodes"],
            "self_loops": network_results["self_loops"],
            "reciprocal_pairs": network_results["reciprocal_pairs"],
            "density_pct": round(
                network_results["unique_pairs"] / (network_results["unique_nodes"] ** 2) * 100, 2
            ),
            "top_recognized": in_deg,
            "top_recognizers": out_deg,
        },
        "recommended_persona_count": rec,
    }



# MAIN
def main():
    df = load_data()

    r1 = method_title_counting(df)
    r2 = method_name_extraction(df)
    r3 = method_capture_recapture(df)
    r4 = method_network_analysis(df)

    synthesize(r1, r2, r3, r4)


if __name__ == "__main__":
    main()