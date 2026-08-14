import pandas as pd
import numpy as np
from scipy import stats

pd.set_option('display.width', 160)
pd.set_option('display.max_columns', 50)

df = pd.read_csv('data.csv')

print("=== SHAPE ===")
print(df.shape)

print("\n=== DTYPES ===")
print(df.dtypes)

print("\n=== NULLS ===")
print(df.isnull().sum()[df.isnull().sum() > 0])

print("\n=== DESCRIBE (outcome + candidate predictors) ===")
cols_of_interest = [
    'number_of_species', 'marine_biodiversity_index',
    'tourist_visits_annual', 'average_tourist_rating_visibility', 'is_eco_tourism_area',
    'pollution_control_index', 'pollution_index', 'marine_pollution_incidents',
    'reported_marine_pollution_incidents', 'marine_fauna_disruptions',
    'eco_friendly_business_percentile', 'is_marine_conservation_zone', 'protection_status',
]
print(df[cols_of_interest].describe())

print("\n=== AREA_ID duplicates? (rows per area) ===")
print(df['area_id'].value_counts().describe())
print(df['area_id'].nunique(), "unique areas out of", len(df), "rows")
