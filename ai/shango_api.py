"""
SHANGO AI - API FastAPI (SOH & RUL)

API de prédiction de l'État de Santé (SOH) et de la
Durée de Vie Restante (RUL) pour les batteries LiFePO4
du système SHANGO / Alioth.
"""

import os
import json
import time
import joblib
import numpy as np

from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator
)

import uvicorn


# ============================================================
# 1. CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Les modèles sont dans le même dossier que shango_api.py
MODELS_DIR = BASE_DIR

SOH_MODEL_FILE = "shango_soh_model.pkl"
RUL_MODEL_FILE = "shango_rul_model.pkl"
SCALER_FILE = "shango_scaler.pkl"
LABEL_MAPPING_FILE = "shango_label_mapping.json"

# Ordre EXACT des features utilisé par les modèles
FEATURE_NAMES = [
    "Voltage_per_cell",
    "Current(A)",
    "Temperature(C)",
    "DoD(%)"
]

# Batterie Alioth : 4 cellules
ALIOTH_CELLS = 4


# ============================================================
# 2. MAPPING SOH
# ============================================================

DEFAULT_SOH_MAPPING = {
    0: "Classe 0",
    1: "Classe 1"
}


def load_label_mapping() -> Dict[Any, str]:
    """
    Charge le mapping des classes SOH.

    Le fichier JSON peut avoir différentes structures.

    Exemples acceptés :

        {
            "0": "Bon",
            "1": "A Remplacer"
        }

    ou :

        {
            "0": {
                "label": "Bon"
            },
            "1": {
                "label": "A Remplacer"
            }
        }

    ou :

        {
            "classes": {
                "0": "Bon",
                "1": "A Remplacer"
            }
        }

    Si le fichier ne peut pas être interprété,
    on utilise le mapping de secours.
    """

    path = os.path.join(
        MODELS_DIR,
        LABEL_MAPPING_FILE
    )

    if not os.path.exists(path):
        print(
            f"⚠️ Fichier de mapping non trouvé : {path}"
        )
        print(
            "⚠️ Utilisation du mapping par défaut."
        )
        return DEFAULT_SOH_MAPPING.copy()

    try:

        with open(
            path,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

        mapping = {}

        # ----------------------------------------------------
        # Cas 1 :
        # {"0": "Bon", "1": "A Remplacer"}
        # ----------------------------------------------------

        if isinstance(data, dict):

            # Si le JSON contient une clé "classes"
            if "classes" in data and isinstance(
                data["classes"],
                dict
            ):
                data = data["classes"]

            for key, value in data.items():

                # Valeur directement sous forme de texte
                if isinstance(value, str):

                    try:
                        mapping[int(key)] = value

                    except (
                        ValueError,
                        TypeError
                    ):
                        pass

                # Valeur sous forme d'objet
                elif isinstance(value, dict):

                    label = (
                        value.get("label")
                        or value.get("name")
                        or value.get("class")
                        or value.get("description")
                    )

                    if label is not None:

                        try:
                            mapping[int(key)] = str(label)

                        except (
                            ValueError,
                            TypeError
                        ):
                            pass

        # ----------------------------------------------------
        # Cas 2 :
        # Liste de classes
        # ----------------------------------------------------

        elif isinstance(data, list):

            for index, value in enumerate(data):

                if isinstance(value, str):

                    mapping[index] = value

                elif isinstance(value, dict):

                    label = (
                        value.get("label")
                        or value.get("name")
                        or value.get("class")
                        or value.get("description")
                    )

                    if label is not None:
                        mapping[index] = str(label)

        # ----------------------------------------------------
        # Vérification
        # ----------------------------------------------------

        if mapping:

            print(
                f"✓ Mapping SOH chargé : {mapping}"
            )

            return mapping

        print(
            "⚠️ Mapping vide ou non reconnu."
        )

        print(
            "⚠️ Utilisation du mapping par défaut."
        )

        return DEFAULT_SOH_MAPPING.copy()

    except Exception as e:

        print(
            f"⚠️ Erreur lecture mapping SOH : {e}"
        )

        print(
            "⚠️ Utilisation du mapping par défaut."
        )

        return DEFAULT_SOH_MAPPING.copy()


SOH_MAPPING = load_label_mapping()


def get_class_label(class_id: Any) -> str:
    """
    Transforme l'identifiant d'une classe en label lisible.
    """

    try:

        class_id_int = int(class_id)

    except (
        ValueError,
        TypeError
    ):

        return str(class_id)

    return SOH_MAPPING.get(
        class_id_int,
        f"Classe {class_id_int}"
    )


# ============================================================
# 3. MODÈLES PYDANTIC
# ============================================================

class PredictionRequest(BaseModel):
    """
    Données reçues par l'API.

    Format utilisé par Laravel / SHANGO :

        device_id
        voltage_v
        current_a
        temperature_c
        dod_percent

    L'API transforme ensuite :

        voltage_v / 4

    pour obtenir :

        Voltage_per_cell
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "SH-001",
                "voltage_v": 12.7,
                "current_a": -3.2,
                "temperature_c": 31.0,
                "dod_percent": 45.0
            }
        }
    )

    device_id: str = Field(
        ...,
        min_length=1,
        description="Identifiant du boîtier / équipement"
    )

    voltage_v: float = Field(
        ...,
        ge=10.0,
        le=14.8,
        description=(
            "Tension totale de la batterie "
            "LiFePO4 4 cellules"
        )
    )

    current_a: float = Field(
        ...,
        ge=-200,
        le=200,
        description="Courant de charge ou décharge en ampères"
    )

    temperature_c: float = Field(
        ...,
        ge=-20,
        le=60,
        description="Température de la batterie en °C"
    )

    dod_percent: float = Field(
        ...,
        ge=0,
        le=100,
        description="Depth of Discharge en pourcentage"
    )

    @field_validator("device_id")
    @classmethod
    def validate_device_id(cls, value: str) -> str:

        value = value.strip()

        if not value:
            raise ValueError(
                "Le device_id ne peut pas être vide."
            )

        return value

    @field_validator("dod_percent")
    @classmethod
    def validate_dod(cls, value: float) -> float:

        if not 0 <= value <= 100:
            raise ValueError(
                "Le DoD doit être compris entre 0% et 100%."
            )

        return value


class PredictionResponse(BaseModel):
    """
    Résultat d'une prédiction.
    """

    timestamp: str

    device_id: str

    input_features: Dict[str, float]

    soh_class: str

    soh_class_id: int

    soh_probabilities: Dict[str, float]

    rul_cycles: int

    # Conversion cycles -> jours non définie pour le moment.
    rul_days: Optional[float] = None

    confidence: float

    warnings: List[str] = Field(
        default_factory=list
    )


class HealthStatus(BaseModel):

    status: str

    message: str

    timestamp: str


class BatchPredictionRequest(BaseModel):

    predictions: List[PredictionRequest]


class BatchPredictionResponse(BaseModel):

    count: int

    results: List[PredictionResponse]

    processing_time_ms: float


# ============================================================
# 4. GESTIONNAIRE DES MODÈLES
# ============================================================

class ModelManager:
    """
    Gestionnaire des modèles ML SHANGO.
    """

    def __init__(
        self,
        models_dir: str
    ):

        self.models_dir = models_dir

        self.soh_model = None

        self.rul_model = None

        self.scaler = None

        self.is_loaded = False

    def load_models(self) -> bool:
        """
        Charge :

        - modèle SOH
        - modèle RUL
        - scaler
        """

        try:

            soh_model_path = os.path.join(
                self.models_dir,
                SOH_MODEL_FILE
            )

            rul_model_path = os.path.join(
                self.models_dir,
                RUL_MODEL_FILE
            )

            scaler_path = os.path.join(
                self.models_dir,
                SCALER_FILE
            )

            print("\n📁 Dossier des modèles :")
            print(self.models_dir)

            print(
                "\n🔎 Vérification des fichiers..."
            )

            # ------------------------------------------------
            # Vérification des fichiers
            # ------------------------------------------------

            if not os.path.exists(
                soh_model_path
            ):

                raise FileNotFoundError(
                    f"SOH model non trouvé : "
                    f"{soh_model_path}"
                )

            if not os.path.exists(
                rul_model_path
            ):

                raise FileNotFoundError(
                    f"RUL model non trouvé : "
                    f"{rul_model_path}"
                )

            if not os.path.exists(
                scaler_path
            ):

                raise FileNotFoundError(
                    f"Scaler non trouvé : "
                    f"{scaler_path}"
                )

            print(
                "✓ shango_soh_model.pkl trouvé"
            )

            print(
                "✓ shango_rul_model.pkl trouvé"
            )

            print(
                "✓ shango_scaler.pkl trouvé"
            )

            # ------------------------------------------------
            # Chargement
            # ------------------------------------------------

            print(
                "\n⏳ Chargement des modèles..."
            )

            self.soh_model = joblib.load(
                soh_model_path
            )

            print(
                "✓ SOH model chargé"
            )

            self.rul_model = joblib.load(
                rul_model_path
            )

            print(
                "✓ RUL model chargé"
            )

            self.scaler = joblib.load(
                scaler_path
            )

            print(
                "✓ Scaler chargé"
            )

            # ------------------------------------------------
            # Vérification features
            # ------------------------------------------------

            scaler_features = getattr(
                self.scaler,
                "n_features_in_",
                None
            )

            soh_features = getattr(
                self.soh_model,
                "n_features_in_",
                None
            )

            rul_features = getattr(
                self.rul_model,
                "n_features_in_",
                None
            )

            print(
                "\n📊 Vérification des features :"
            )

            print(
                f"   Scaler : {scaler_features}"
            )

            print(
                f"   SOH    : {soh_features}"
            )

            print(
                f"   RUL    : {rul_features}"
            )

            if (
                scaler_features is not None
                and scaler_features != 4
            ):

                raise ValueError(
                    f"Le scaler attend "
                    f"{scaler_features} features "
                    f"au lieu de 4."
                )

            if (
                soh_features is not None
                and soh_features != 4
            ):

                raise ValueError(
                    f"Le modèle SOH attend "
                    f"{soh_features} features "
                    f"au lieu de 4."
                )

            if (
                rul_features is not None
                and rul_features != 4
            ):

                raise ValueError(
                    f"Le modèle RUL attend "
                    f"{rul_features} features "
                    f"au lieu de 4."
                )

            # ------------------------------------------------
            # Classes SOH
            # ------------------------------------------------

            classes = getattr(
                self.soh_model,
                "classes_",
                None
            )

            if classes is not None:

                print(
                    "\n🏷️ Classes SOH détectées :"
                )

                for class_id in classes:

                    print(
                        f"   {class_id} -> "
                        f"{get_class_label(class_id)}"
                    )

            self.is_loaded = True

            print(
                "\n" + "=" * 70
            )

            print(
                "✅ TOUS LES MODÈLES "
                "SONT CHARGÉS AVEC SUCCÈS"
            )

            print(
                "=" * 70
            )

            return True

        except Exception as e:

            print(
                "\n" + "=" * 70
            )

            print(
                "❌ ERREUR LORS DU CHARGEMENT "
                "DES MODÈLES"
            )

            print(
                "=" * 70
            )

            print(
                str(e)
            )

            self.is_loaded = False

            return False

    def predict(
        self,
        features: np.ndarray
    ) -> tuple:
        """
        Effectue la prédiction.

        Entrée :

            [
                Voltage_per_cell,
                Current(A),
                Temperature(C),
                DoD(%)
            ]

        Sortie :

            soh_class_id
            soh_probabilities
            rul_cycles
        """

        if not self.is_loaded:

            raise RuntimeError(
                "Les modèles ne sont pas chargés."
            )

        # ----------------------------------------------------
        # Vérification
        # ----------------------------------------------------

        if len(features) != 4:

            raise ValueError(
                "Le modèle SHANGO attend "
                "exactement 4 features."
            )

        # ----------------------------------------------------
        # Tableau 2D
        # ----------------------------------------------------

        features_2d = features.reshape(
            1,
            -1
        )

        # ----------------------------------------------------
        # Normalisation
        # ----------------------------------------------------

        features_scaled = self.scaler.transform(
            features_2d
        )

        # ----------------------------------------------------
        # SOH
        # ----------------------------------------------------

        soh_prediction = self.soh_model.predict(
            features_scaled
        )[0]

        # ----------------------------------------------------
        # Probabilités
        # ----------------------------------------------------

        if hasattr(
            self.soh_model,
            "predict_proba"
        ):

            soh_probabilities = (
                self.soh_model
                .predict_proba(
                    features_scaled
                )[0]
            )

        else:

            raise RuntimeError(
                "Le modèle SOH ne possède pas "
                "la méthode predict_proba()."
            )

        # ----------------------------------------------------
        # RUL
        # ----------------------------------------------------

        rul_prediction = self.rul_model.predict(
            features_scaled
        )[0]

        # ----------------------------------------------------
        # Classe SOH
        # ----------------------------------------------------

        try:

            soh_class_id = int(
                soh_prediction
            )

        except (
            ValueError,
            TypeError
        ):

            raise ValueError(
                f"Classe SOH inattendue : "
                f"{soh_prediction}"
            )

        # ----------------------------------------------------
        # RUL
        # ----------------------------------------------------

        rul_cycles = int(
            round(
                float(rul_prediction)
            )
        )

        # Un nombre négatif de cycles
        # n'est pas exploitable.
        rul_cycles = max(
            0,
            rul_cycles
        )

        return (
            soh_class_id,
            soh_probabilities,
            rul_cycles
        )


# ============================================================
# 5. INITIALISATION FASTAPI
# ============================================================

app = FastAPI(

    title="SHANGO AI - API Batterie",

    description=(
        "API de prédiction SOH et RUL "
        "pour les batteries LiFePO4 "
        "du système SHANGO."
    ),

    version="1.0.0",

    docs_url="/docs",

    redoc_url="/redoc"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"]
)


# ============================================================
# GESTIONNAIRE DES MODÈLES
# ============================================================

model_manager = ModelManager(
    MODELS_DIR
)


# ============================================================
# 6. STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event():

    print("\n")

    print(
        "=" * 70
    )

    print(
        "🚀 DÉMARRAGE DE SHANGO AI API"
    )

    print(
        "=" * 70
    )

    if model_manager.load_models():

        print(
            "✓ API SHANGO AI prête."
        )

    else:

        print(
            "⚠️ API démarrée mais "
            "les modèles ne sont pas chargés."
        )

    print(
        "=" * 70
    )

    print()


# ============================================================
# 7. HEALTH CHECK
# ============================================================

@app.get(
    "/health",
    response_model=HealthStatus,
    tags=["System"]
)
async def health_check():

    is_healthy = (
        model_manager.is_loaded
    )

    return HealthStatus(

        status=(
            "healthy"
            if is_healthy
            else "unhealthy"
        ),

        message=(
            "API opérationnelle "
            "et modèles chargés"
            if is_healthy
            else
            "API opérationnelle "
            "mais modèles non chargés"
        ),

        timestamp=datetime.now().isoformat()
    )


# ============================================================
# 8. ROOT
# ============================================================

@app.get(
    "/",
    tags=["Info"]
)
async def root():

    return {

        "name":
            "SHANGO AI - "
            "Battery Health Prediction",

        "version":
            "1.0.0",

        "status": (
            "healthy"
            if model_manager.is_loaded
            else "models_not_loaded"
        ),

        "docs":
            "/docs",

        "health":
            "/health"
    }


# ============================================================
# 9. INFO
# ============================================================

@app.get(
    "/info",
    tags=["Info"]
)
async def info():

    soh_classes = []

    if model_manager.soh_model is not None:

        classes = getattr(
            model_manager.soh_model,
            "classes_",
            []
        )

        for class_id in classes:

            soh_classes.append({

                "id":
                    int(class_id),

                "label":
                    get_class_label(
                        class_id
                    )
            })

    return {

        "name":
            "SHANGO AI - "
            "Battery Health Prediction API",

        "version":
            "1.0.0",

        "description":
            "Prédiction SOH et RUL "
            "des batteries LiFePO4",

        "models_loaded":
            model_manager.is_loaded,

        "models": {

            "soh":
                SOH_MODEL_FILE,

            "rul":
                RUL_MODEL_FILE,

            "scaler":
                SCALER_FILE,

            "label_mapping":
                LABEL_MAPPING_FILE
        },

        "soh_classes":
            soh_classes,

        "input_features":
            FEATURE_NAMES,

        "battery_cells":
            ALIOTH_CELLS
    }


# ============================================================
# 10. PRÉDICTION UNIQUE
# ============================================================

@app.post(
    "/predict",
    response_model=PredictionResponse,
    tags=["Predictions"],
    summary="Prédire SOH et RUL"
)
async def predict(
    request: PredictionRequest
) -> PredictionResponse:

    # --------------------------------------------------------
    # Vérification modèles
    # --------------------------------------------------------

    if not model_manager.is_loaded:

        raise HTTPException(

            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),

            detail=(
                "Les modèles ne sont pas chargés."
            )
        )

    try:

        # ====================================================
        # 1. CONVERSION DE LA TENSION
        # ====================================================

        voltage_per_cell = (
            request.voltage_v
            / ALIOTH_CELLS
        )

        # ====================================================
        # 2. CONSTRUCTION DES FEATURES
        # ====================================================

        features = np.array(

            [

                voltage_per_cell,

                request.current_a,

                request.temperature_c,

                request.dod_percent

            ],

            dtype=float
        )

        # ====================================================
        # 3. PRÉDICTION
        # ====================================================

        (
            soh_class_id,
            soh_proba,
            rul_cycles

        ) = model_manager.predict(
            features
        )

        # ====================================================
        # 4. LABEL SOH
        # ====================================================

        soh_class = get_class_label(
            soh_class_id
        )

        # ====================================================
        # 5. PROBABILITÉS
        # ====================================================

        soh_probabilities = {}

        classes = getattr(
            model_manager.soh_model,
            "classes_",
            None
        )

        if classes is None:

            classes = list(
                range(
                    len(soh_proba)
                )
            )

        for class_id, probability in zip(

            classes,

            soh_proba

        ):

            label = get_class_label(
                class_id
            )

            soh_probabilities[
                label
            ] = round(
                float(probability),
                6
            )

        # ====================================================
        # 6. CONFIANCE
        # ====================================================

        confidence = round(

            float(
                np.max(
                    soh_proba
                )
            ),

            6
        )

        # ====================================================
        # 7. AVERTISSEMENTS
        # ====================================================

        warnings = []

        if request.temperature_c > 45:

            warnings.append(

                f"Température élevée : "
                f"{request.temperature_c}°C"
            )

        if request.temperature_c < 0:

            warnings.append(

                f"Température basse : "
                f"{request.temperature_c}°C"
            )

        if request.dod_percent > 90:

            warnings.append(

                f"DoD élevé : "
                f"{request.dod_percent}%"
            )

        if rul_cycles < 500:

            warnings.append(

                f"RUL faible : "
                f"{rul_cycles} cycles"
            )

        # ====================================================
        # 8. RÉPONSE
        # ====================================================

        return PredictionResponse(

            timestamp=
                datetime.now().isoformat(),

            device_id=
                request.device_id,

            input_features={

                "voltage_v":
                    float(
                        request.voltage_v
                    ),

                "voltage_per_cell":
                    round(
                        float(
                            voltage_per_cell
                        ),
                        6
                    ),

                "current_a":
                    float(
                        request.current_a
                    ),

                "temperature_c":
                    float(
                        request.temperature_c
                    ),

                "dod_percent":
                    float(
                        request.dod_percent
                    )
            },

            soh_class=
                soh_class,

            soh_class_id=
                soh_class_id,

            soh_probabilities=
                soh_probabilities,

            rul_cycles=
                rul_cycles,

            # Pas de conversion arbitraire
            # cycles -> jours.
            rul_days=
                None,

            confidence=
                confidence,

            warnings=
                warnings
        )

    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(

            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                "Erreur lors de la prédiction : "
                f"{str(e)}"
            )
        )


# ============================================================
# 11. PRÉDICTION BATCH
# ============================================================

@app.post(
    "/predict-batch",
    response_model=BatchPredictionResponse,
    tags=["Predictions"],
    summary="Prédictions multiples"
)
async def predict_batch(
    request: BatchPredictionRequest
) -> BatchPredictionResponse:

    if not model_manager.is_loaded:

        raise HTTPException(

            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),

            detail=(
                "Les modèles ne sont pas chargés."
            )
        )

    start_time = time.time()

    try:

        results = []

        for prediction_request in (
            request.predictions
        ):

            result = await predict(
                prediction_request
            )

            results.append(
                result
            )

        processing_time = (
            time.time()
            - start_time
        ) * 1000

        return BatchPredictionResponse(

            count=
                len(results),

            results=
                results,

            processing_time_ms=
                round(
                    processing_time,
                    3
                )
        )

    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(

            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                "Erreur lors du traitement batch : "
                f"{str(e)}"
            )
        )


# ============================================================
# 12. FEATURES
# ============================================================

@app.get(
    "/features",
    tags=["Info"]
)
async def get_features_info():

    return {

        "input_format": {

            "device_id":
                "Identifiant du boîtier",

            "voltage_v":
                "Tension totale de la batterie",

            "current_a":
                "Courant de charge ou décharge",

            "temperature_c":
                "Température de la batterie",

            "dod_percent":
                "Depth of Discharge"
        },

        "model_features_order":
            FEATURE_NAMES,

        "conversion": {

            "voltage_per_cell":
                "voltage_v / 4"
        },

        "voltage_per_cell": {

            "description":
                "Tension par cellule LiFePO4",

            "unit":
                "V",

            "range":
                "2.5 - 3.6 V"
        },

        "current_a": {

            "description":
                "Courant de charge ou décharge",

            "unit":
                "A"
        },

        "temperature_c": {

            "description":
                "Température de la batterie",

            "unit":
                "°C",

            "range":
                "-20 - 60 °C"
        },

        "dod_percent": {

            "description":
                "Depth of Discharge",

            "unit":
                "%",

            "range":
                "0 - 100 %"
        }
    }


# ============================================================
# 13. RECOMMANDATIONS
# ============================================================

@app.get(
    "/recommendations",
    tags=["Info"]
)
async def get_recommendations():

    return {

        "temperature": {

            "description":
                "Surveiller la température "
                "de fonctionnement.",

            "warning_above":
                "45°C",

            "warning_below":
                "0°C"
        },

        "dod": {

            "description":
                "Une profondeur de décharge "
                "élevée peut être associée "
                "à une usure accrue.",

            "warning_above":
                "90%"
        },

        "rul": {

            "description":
                "Le RUL fourni par le modèle "
                "est exprimé en cycles restants.",

            "unit":
                "cycles"
        }
    }


# ============================================================
# 14. GESTION DES ERREURS
# ============================================================

@app.exception_handler(ValueError)
async def value_error_handler(
    request,
    exc
):

    return JSONResponse(

        status_code=422,

        content={
            "detail":
                str(exc)
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request,
    exc
):

    return JSONResponse(

        status_code=500,

        content={
            "detail":
                "Erreur serveur interne"
        }
    )


# ============================================================
# 15. LANCEMENT LOCAL
# ============================================================

if __name__ == "__main__":

    print("\n")

    print(
        "=" * 70
    )

    print(
        "🔋 SHANGO AI - "
        "Battery Health Prediction API"
    )

    print(
        "=" * 70
    )

    print(
        "📍 URL : "
        "http://127.0.0.1:8000"
    )

    print(
        "📚 Documentation : "
        "http://127.0.0.1:8000/docs"
    )

    print(
        "❤️ Health : "
        "http://127.0.0.1:8000/health"
    )

    print(
        "=" * 70
    )

    print()

    uvicorn.run(

        "shango_api:app",

        host="0.0.0.0",

        port=8000,

        reload=True,

        log_level="info"
    )