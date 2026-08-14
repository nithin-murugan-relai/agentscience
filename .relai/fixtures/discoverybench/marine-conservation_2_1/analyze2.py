import pandas as pd
import numpy as np
from scipy import stats

pd.set_option('display.width', 160)
pd.set_option('display.max_columns', 50)
pd.set_option('display.max_rows', 100)

df = pd.read_csv('data.csv')

print("=== VARIANCE CHECK: nunique per column ===")
for c in df.columns:
    print(f"{c:45s} nunique={df[c].nunique():5d}  dtype={df[c].dtype}")

print("\n=== is_eco_tourism_area value counts ===")
print(df['is_eco_tourism_area'].value_counts(dropna=False))

print("\n=== protection_status value counts ===")
print(df['protection_status'].value_counts(dropna=False))

print("\n=== is_marine_conservation_zone value counts ===")
print(df['is_marine_conservation_zone'].value_counts(dropna=False))

print("\n=== area_id counts ===")
print(df['area_id'].value_counts(dropna=False))

# Candidate "tourist activity" columns
tourist_cols = ['tourist_visits_annual', 'average_tourist_rating_visibility']
pollution_control_cols = ['pollution_control_index', 'pollution_index', 'marine_pollution_incidents',
                           'reported_marine_pollution_incidents', 'marine_fauna_disruptions']
eco_tourism_cols = ['is_eco_tourism_area', 'eco_friendly_business_percentile']

outcome = 'number_of_species'

print(f"\n=== Correlations with {outcome} (Pearson & Spearman, pairwise complete) ===")
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
num_cols = [c for c in num_cols if c != outcome]
rows = []
for c in num_cols:
    sub = df[[c, outcome]].dropna()
    if sub[c].nunique() <= 1 or len(sub) < 10:
        rows.append((c, np.nan, np.nan, np.nan, np.nan, len(sub), 'no variance or too few rows'))
        continue
    r, p = stats.pearsonr(sub[c], sub[outcome])
    rho, ps = stats.spearmanr(sub[c], sub[outcome])
    rows.append((c, r, p, rho, ps, len(sub), ''))

res = pd.DataFrame(rows, columns=['var', 'pearson_r', 'pearson_p', 'spearman_rho', 'spearman_p', 'n', 'note'])
res = res.sort_values('pearson_p')
print(res.to_string(index=False))

# Boolean/categorical group comparisons
print("\n=== Group comparisons (t-test) for boolean predictors vs number_of_species ===")
bool_like = ['protection_status', 'is_eco_tourism_area']
for c in bool_like:
    sub = df[[c, outcome]].dropna()
    groups = sub[c].unique()
    if len(groups) == 2:
        g0 = sub[sub[c] == groups[0]][outcome]
        g1 = sub[sub[c] == groups[1]][outcome]
        t, p = stats.ttest_ind(g0, g1, equal_var=False)
        print(f"{c}: groups={groups}, mean0={g0.mean():.2f} (n={len(g0)}), mean1={g1.mean():.2f} (n={len(g1)}), t={t:.3f}, p={p:.4f}")

# object-typed True/False strings
print("\n=== is_marine_conservation_zone (object dtype) unique values ===")
print(df['is_marine_conservation_zone'].unique())
sub = df[['is_marine_conservation_zone', outcome]].dropna()
sub['flag'] = sub['is_marine_conservation_zone'].astype(str)
groups = sub['flag'].unique()
print(sub.groupby('flag')[outcome].agg(['mean','count']))
