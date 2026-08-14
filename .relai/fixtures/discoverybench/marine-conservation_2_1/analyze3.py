import pandas as pd
import numpy as np
from scipy import stats

pd.set_option('display.width', 160)
pd.set_option('display.max_columns', 50)

df = pd.read_csv('data.csv')
outcome = 'number_of_species'

# 1. Regression: number_of_species ~ pollution_control_index
sub = df[['pollution_control_index', outcome]].dropna()
slope, intercept, r, p, se = stats.linregress(sub['pollution_control_index'], sub[outcome])
print(f"number_of_species ~ pollution_control_index")
print(f"slope={slope:.4f}, intercept={intercept:.4f}, r={r:.6f}, r2={r**2:.6f}, p={p:.3e}, n={len(sub)}")

# check residuals
pred = intercept + slope * sub['pollution_control_index']
resid = sub[outcome] - pred
print(f"residual std={resid.std():.3f}, max abs resid={resid.abs().max():.3f}")

# 2. Check duplicate rows
print("\n=== Exact duplicate rows ===")
print("n duplicated (any):", df.duplicated().sum())

# 3. Within-area relationship (does it hold inside each area_id, or is it driven by between-area differences?)
print("\n=== Within area_id: pollution_control_index vs number_of_species ===")
for aid, g in df.dropna(subset=['area_id']).groupby('area_id'):
    sub_g = g[['pollution_control_index', outcome]].dropna()
    if len(sub_g) > 5 and sub_g['pollution_control_index'].nunique() > 1:
        r_g, p_g = stats.pearsonr(sub_g['pollution_control_index'], sub_g[outcome])
        print(f"{aid}: n={len(sub_g)}, r={r_g:.4f}, p={p_g:.3e}, pollution_control range=({sub_g['pollution_control_index'].min():.1f},{sub_g['pollution_control_index'].max():.1f})")

# 4. pollution_index (separate var, 1-100 more polluted=higher) vs number_of_species -- confirm non-significant
sub2 = df[['pollution_index', outcome]].dropna()
r2v, p2v = stats.pearsonr(sub2['pollution_index'], sub2[outcome])
print(f"\npollution_index vs number_of_species: r={r2v:.4f}, p={p2v:.4f}, n={len(sub2)}")

# 5. eco_friendly_business_percentile vs number_of_species -- confirm non-significant, show effect size/CI
sub3 = df[['eco_friendly_business_percentile', outcome]].dropna()
r3, p3 = stats.pearsonr(sub3['eco_friendly_business_percentile'], sub3[outcome])
print(f"eco_friendly_business_percentile vs number_of_species: r={r3:.4f}, p={p3:.4f}, n={len(sub3)}")

# 6. Confirm zero-variance columns precisely
for c in ['tourist_visits_annual', 'average_tourist_rating_visibility', 'is_eco_tourism_area', 'local_awareness_campaigns']:
    print(f"\n{c}: unique values = {df[c].unique()}, n non-null = {df[c].notnull().sum()}")

# 7. marine_biodiversity_index vs number_of_species and vs pollution_control_index (sanity - two 'species' vars disagree?)
sub4 = df[['marine_biodiversity_index', outcome, 'pollution_control_index']].dropna()
r4, p4 = stats.pearsonr(sub4['marine_biodiversity_index'], sub4[outcome])
r5, p5 = stats.pearsonr(sub4['marine_biodiversity_index'], sub4['pollution_control_index'])
print(f"\nmarine_biodiversity_index vs number_of_species: r={r4:.4f}, p={p4:.4f}")
print(f"marine_biodiversity_index vs pollution_control_index: r={r5:.4f}, p={p5:.4f}")
