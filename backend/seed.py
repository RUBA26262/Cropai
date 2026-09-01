"""Seeds the crops + diseases master tables with realistic demo data.
Run once after the tables are created: python seed.py
"""
from app.database.session import SessionLocal, Base, engine
import app.models  # noqa
from app.models.crop import Crop
from app.models.disease import Disease

Base.metadata.create_all(bind=engine)
db = SessionLocal()

CROPS_AND_DISEASES = {
    "Tomato": {
        "category": "Vegetable",
        "diseases": [
            dict(name="Early Blight", symptoms="Dark concentric-ring spots on older leaves, yellowing around lesions.",
                 causes="Fungal pathogen (Alternaria solani), favored by warm, humid conditions.",
                 prevention="Crop rotation, avoid overhead watering, remove infected debris.",
                 management="Remove affected leaves; consult a locally approved fungicide label and an agricultural expert for treatment.",
                 default_severity="medium"),
            dict(name="Late Blight", symptoms="Water-soaked lesions turning brown/black, white fungal growth on undersides.",
                 causes="Oomycete pathogen (Phytophthora infestans), spreads rapidly in cool, wet weather.",
                 prevention="Resistant varieties, good airflow, avoid working in wet fields.",
                 management="Isolate/remove infected plants quickly; consult a locally approved fungicide label and an agricultural expert immediately, as this disease spreads fast.",
                 default_severity="high"),
            dict(name="Bacterial Spot", symptoms="Small dark water-soaked spots on leaves and fruit.",
                 causes="Xanthomonas bacteria, spread by splashing water and contaminated tools.",
                 prevention="Use disease-free seed, avoid overhead irrigation, sanitize tools.",
                 management="Remove infected material; consult an agricultural expert for locally approved bactericide options.",
                 default_severity="medium"),
        ],
    },
    "Rice": {
        "category": "Cereal",
        "diseases": [
            dict(name="Bacterial Leaf Blight", symptoms="Yellow to white lesions along leaf veins, wilting in severe cases.",
                 causes="Xanthomonas oryzae bacteria, spreads through water and wind-driven rain.",
                 prevention="Resistant varieties, balanced fertilization, proper field drainage.",
                 management="Drain field if possible; consult an agricultural expert for locally approved treatment.",
                 default_severity="high"),
            dict(name="Brown Spot", symptoms="Small circular brown lesions with gray centers on leaves and grains.",
                 causes="Fungal pathogen (Bipolaris oryzae), linked to nutrient-deficient soils.",
                 prevention="Balanced fertilization (especially potassium), seed treatment.",
                 management="Improve soil nutrition; consult an agricultural expert for fungicide guidance if severe.",
                 default_severity="medium"),
        ],
    },
    "Maize": {"category": "Cereal", "diseases": [
        dict(name="Northern Corn Leaf Blight", symptoms="Long cigar-shaped gray-green lesions on leaves.",
             causes="Fungal pathogen (Exserohilum turcicum), favored by humid, moderate temperatures.",
             prevention="Resistant hybrids, crop rotation, residue management.",
             management="Consult an agricultural expert for locally approved fungicide options if infection is severe.",
             default_severity="medium"),
        dict(name="Common Rust", symptoms="Small reddish-brown pustules on both leaf surfaces.",
             causes="Fungal pathogen (Puccinia sorghi), spread by windborne spores.",
             prevention="Resistant hybrids, early planting.",
             management="Monitor closely; consult an agricultural expert if pustules spread rapidly.",
             default_severity="low"),
    ]},
    "Potato": {"category": "Vegetable", "diseases": [
        dict(name="Early Blight", symptoms="Target-like brown spots on lower/older leaves.",
             causes="Fungal pathogen (Alternaria solani).",
             prevention="Crop rotation, adequate plant spacing for airflow.",
             management="Remove affected foliage; consult an agricultural expert for fungicide guidance.",
             default_severity="medium"),
        dict(name="Late Blight", symptoms="Dark, water-soaked lesions spreading rapidly, especially in wet weather.",
             causes="Oomycete pathogen (Phytophthora infestans).",
             prevention="Resistant varieties, avoid excess moisture.",
             management="Act quickly — remove infected plants and consult an agricultural expert immediately.",
             default_severity="high"),
    ]},
    "Apple": {"category": "Fruit", "diseases": [
        dict(name="Apple Scab", symptoms="Olive-green to black velvety spots on leaves and fruit.",
             causes="Fungal pathogen (Venturia inaequalis), favored by cool wet spring weather.",
             prevention="Rake and destroy fallen leaves, resistant varieties.",
             management="Consult an agricultural expert for locally approved fungicide timing.",
             default_severity="medium"),
        dict(name="Cedar Apple Rust", symptoms="Bright orange-yellow spots on leaves.",
             causes="Fungal pathogen requiring a nearby juniper/cedar host.",
             prevention="Remove nearby cedar hosts if feasible, resistant varieties.",
             management="Consult an agricultural expert for treatment options.",
             default_severity="low"),
    ]},
    "Grape": {"category": "Fruit", "diseases": [
        dict(name="Black Rot", symptoms="Small tan spots with dark borders on leaves, shriveled black fruit.",
             causes="Fungal pathogen (Guignardia bidwellii), favored by warm humid weather.",
             prevention="Prune for airflow, remove mummified fruit.",
             management="Consult an agricultural expert for locally approved fungicide programs.",
             default_severity="medium"),
        dict(name="Leaf Blight (Isariopsis)", symptoms="Angular brown lesions along leaf veins.",
             causes="Fungal pathogen, favored by wet conditions.",
             prevention="Canopy management for airflow.",
             management="Consult an agricultural expert for treatment guidance.",
             default_severity="low"),
    ]},
    "Pepper": {"category": "Vegetable", "diseases": [
        dict(name="Bacterial Spot", symptoms="Small water-soaked spots that turn brown/scabby.",
             causes="Xanthomonas bacteria, spread by water splash.",
             prevention="Disease-free seed, avoid overhead watering.",
             management="Consult an agricultural expert for locally approved bactericide options.",
             default_severity="medium"),
    ]},
    "Cucumber": {"category": "Vegetable", "diseases": [
        dict(name="Downy Mildew", symptoms="Yellow angular spots on upper leaf surface, gray mold underneath.",
             causes="Oomycete pathogen, favored by cool humid conditions.",
             prevention="Resistant varieties, improve air circulation.",
             management="Consult an agricultural expert for locally approved fungicide options.",
             default_severity="high"),
        dict(name="Powdery Mildew", symptoms="White powdery coating on leaves and stems.",
             causes="Fungal pathogen, favored by high humidity and moderate temperatures.",
             prevention="Adequate spacing, resistant varieties.",
             management="Consult an agricultural expert for treatment guidance.",
             default_severity="medium"),
    ]},
    "Mango": {"category": "Fruit", "diseases": [
        dict(name="Anthracnose", symptoms="Dark sunken lesions on leaves, flowers, and fruit.",
             causes="Fungal pathogen (Colletotrichum gloeosporioides), favored by humid conditions.",
             prevention="Prune for airflow, remove infected debris.",
             management="Consult an agricultural expert for locally approved fungicide programs.",
             default_severity="medium"),
    ]},
    "Beans": {"category": "Legume", "diseases": [
        dict(name="Angular Leaf Spot", symptoms="Angular brown lesions bound by leaf veins.",
             causes="Fungal pathogen, spread by rain splash.",
             prevention="Crop rotation, disease-free seed.",
             management="Consult an agricultural expert for treatment guidance.",
             default_severity="medium"),
        dict(name="Rust", symptoms="Small reddish-brown pustules on leaf undersides.",
             causes="Fungal pathogen, spread by windborne spores.",
             prevention="Resistant varieties, crop rotation.",
             management="Consult an agricultural expert if infection is severe.",
             default_severity="low"),
    ]},
}


def run():
    for crop_name, info in CROPS_AND_DISEASES.items():
        crop = db.query(Crop).filter(Crop.name == crop_name).first()
        if not crop:
            crop = Crop(name=crop_name, category=info["category"])
            db.add(crop)
            db.commit()
            db.refresh(crop)

        for d in info["diseases"]:
            existing = db.query(Disease).filter(Disease.crop_id == crop.id, Disease.name == d["name"]).first()
            if not existing:
                db.add(Disease(crop_id=crop.id, **d))
        db.commit()
    print(f"Seeded {len(CROPS_AND_DISEASES)} crops and their diseases.")


if __name__ == "__main__":
    run()
    db.close()
