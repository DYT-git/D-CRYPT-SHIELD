import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
import os

print("Generating synthetic ground truth data based on Elliptic Dataset distributions...")
np.random.seed(42)
n_samples = 5000

# Features:
# temporal_span: hours between txs (illicit usually faster/automated)
# value_continuity: % of value forwarded (illicit usually 95-100% to avoid leftover dust)
# degree_centrality: number of unique connections (illicit often uses hubs/mixers, degree is higher)

# Licit profiles (Label = 0)
temporal_span_licit = np.random.normal(loc=72.0, scale=48.0, size=n_samples)
temporal_span_licit = np.clip(temporal_span_licit, 1.0, 720.0)
value_cont_licit = np.random.normal(loc=0.50, scale=0.30, size=n_samples)
value_cont_licit = np.clip(value_cont_licit, 0.01, 1.0)
degree_licit = np.random.poisson(lam=3, size=n_samples)

# Illicit profiles (Label = 1) -> e.g. peel chains, mixers
temporal_span_illicit = np.random.normal(loc=2.0, scale=3.0, size=n_samples)
temporal_span_illicit = np.clip(temporal_span_illicit, 0.1, 24.0)
value_cont_illicit = np.random.normal(loc=0.98, scale=0.02, size=n_samples)
value_cont_illicit = np.clip(value_cont_illicit, 0.8, 1.0)
degree_illicit = np.random.poisson(lam=15, size=n_samples)

X_licit = np.column_stack((temporal_span_licit, value_cont_licit, degree_licit))
X_illicit = np.column_stack((temporal_span_illicit, value_cont_illicit, degree_illicit))

y_licit = np.zeros(n_samples)
y_illicit = np.ones(n_samples)

X = np.vstack((X_licit, X_illicit))
y = np.concatenate((y_licit, y_illicit))

df = pd.DataFrame(X, columns=['temporal_span', 'value_continuity', 'degree_centrality'])
df['label'] = y

print("Training Random Forest Classifier...")
X_train, X_test, y_train, y_test = train_test_split(df[['temporal_span', 'value_continuity', 'degree_centrality']], df['label'], test_size=0.2, random_state=42)

clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
clf.fit(X_train, y_train)

preds = clf.predict(X_test)
print(classification_report(y_test, preds))

os.makedirs('models', exist_ok=True)
joblib.dump(clf, 'models/risk_model.pkl')
print("Model exported to models/risk_model.pkl successfully!")
