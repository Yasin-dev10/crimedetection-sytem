"""Local health and prediction smoke test for the active deployment model."""

from app import AI_MODEL_API_KEY, app


client = app.test_client()

health = client.get("/health")
assert health.status_code == 200, health.get_data(as_text=True)
health_payload = health.get_json()
assert health_payload["modelName"] == "somberta-b", health_payload
assert health_payload["modelBackend"] == "transformer", health_payload
print("HEALTH", health.status_code, health_payload)

headers = {"X-API-Key": AI_MODEL_API_KEY} if AI_MODEL_API_KEY else {}
examples = (
    ("Nin hubaysan ayaa qof ku dilay Muqdisho", "crime-related"),
    ("Ardaydu maanta waxay dhigteen casharro ku saabsan xisaabta.", "not crime-related"),
)

for text, expected_label in examples:
    prediction = client.post("/predict", json={"text": text}, headers=headers)
    assert prediction.status_code == 200, prediction.get_data(as_text=True)
    prediction_payload = prediction.get_json()
    assert prediction_payload["prediction"] == expected_label, prediction_payload
    assert prediction_payload["rawPrediction"] == expected_label, prediction_payload
    print("PREDICT", prediction.status_code, prediction_payload)
