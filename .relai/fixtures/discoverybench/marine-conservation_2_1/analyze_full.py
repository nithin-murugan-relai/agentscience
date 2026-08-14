import pandas as pd
import numpy as np
from scipy import stats

pd.set_option('display.width', 160)
pd.set_option('display.max_columns', 50)

df = pd.read_csv('data.csv')
outcome = 'number_of_species'

print("=== shape / dtypes ===")
print(df.shape)
print(df.dtypes)

print("\n=== describe outcome ===")
print(df[outcome].describe())

print("\n=== missing values per column ===")
print(df.isnull().sum()[df.isnull().sum() > 0])

print("\n=== duplicated rows (any) ===")
print(df.duplicated().sum())

print("\n=== area_id counts ===")
print(df['area_id'].value_counts())

# Candidate variable groups per the research question
tourist_vars = ['tourist_visits_annual', 'average_tourist_rating_visibility', 'is_eco_tourism_area']
pollution_control_vars = ['pollution_control_index', 'pollution_index', 'reported_marine_pollution_incidents',
                           'marine_pollution_incidents', 'marine_fauna_disruptions']
eco_tourism_vars = ['is_eco_tourism_area', 'eco_friendly_business_percentile']

all_vars = sorted(set(tourist_vars + pollution_control_vars + eco_tourism_vars))

print("\n=== unique value counts for candidate vars (check for constants) ===")
for c in all_vars:
    print(f"{c}: n_unique={df[c].nunique()}, sample={df[c].dropna().unique()[:5]}")

print("\n=== Pearson correlation of each candidate var with number_of_species ===")
for c in all_vars:
    sub = df[[c, outcome]].dropna()
    if sub[c].nunique() <= 1:
        print(f"{c}: CONSTANT, skipped")
        continue
    r, p = stats.pearsonr(sub[c], sub[outcome])
    print(f"{c}: r={r:.4f}, p={p:.4g}, n={len(sub)}")

print("\n=== Spearman correlation (robust to nonlinearity) ===")
for c in all_vars:
    sub = df[[c, outcome]].dropna()
    if sub[c].nunique() <= 1:
        continue
    r, p = stats.spearmanr(sub[c], sub[outcome])
    print(f"{c}: rho={r:.4f}, p={p:.4g}, n={len(sub)}")

print("\n=== Full correlation matrix context: number_of_species vs ALL numeric cols ===")
numeric_cols = df.select_dtypes(include=[np.number, bool]).columns.tolist()
corrs = []
for c in numeric_cols:
    if c == outcome:
        continue
    sub = df[[c, outcome]].dropna()
    if sub[c].nunique() <= 1:
        continue
    r, p = stats.pearsonr(sub[c], sub[outcome])
    corrs.append((c, r, p, len(sub)))
corrs.sort(key=lambda x: -abs(x[1]))
for c, r, p, n in corrs:
    print(f"{c}: r={r:.4f}, p={p:.4g}, n={n}")

# marine_biodiversity_index sanity - a second "species variety" var
print("\n=== marine_biodiversity_index vs number_of_species ===")
sub = df[['marine_biodiversity_index', outcome]].dropna()
r, p = stats.pearsonr(sub['marine_biodiversity_index'], sub[outcome])
print(f"r={r:.4f}, p={p:.4g}, n={len(sub)}")
