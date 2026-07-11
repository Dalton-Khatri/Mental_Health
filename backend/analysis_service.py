from abc import ABC, abstractmethod

class AudioAnalysisService(ABC):
    """
    Abstract interface for audio analysis.
    This serves as a clean boundary/service layer to easily swap out the mock/hardcoded implementation
    with the actual machine learning model in the future.
    """
    @abstractmethod
    def analyze_assessment(self, file_path: str) -> dict:
        """
        Analyze assessment audio file and return a dictionary containing the prediction results.
        Expected keys:
            - "prediction": str (e.g. "Normal", "Depression", "Anxiety", "Suicidal")
            - "confidence": float (between 0.0 and 1.0)
        """
        pass

    @abstractmethod
    def analyze_screening(self, file_path: str) -> dict:
        """
        Analyze screening audio file and return a dictionary containing the screening classification results.
        Expected keys:
            - "conditionLabel": str (e.g. "Normal", "Depression", "Anxiety", "Suicidal")
            - "conditionConfidence": float (between 0.0 and 1.0)
            - "causeLabel": str (e.g. "None", "Academic stress", "Jobs and careers", "Relationships")
            - "causeConfidence": float (between 0.0 and 1.0)
        """
        pass

class HardcodedAudioAnalysisService(AudioAnalysisService):
    """
    Concrete implementation of AudioAnalysisService returning hardcoded/simulated results for development and testing.
    """
    def analyze_assessment(self, file_path: str) -> dict:
        # For now, return a realistic hardcoded prediction
        return {
            "prediction": "Normal",
            "confidence": 0.88
        }

    def analyze_screening(self, file_path: str) -> dict:
        # For now, return realistic hardcoded screening classifications
        return {
            "conditionLabel": "Normal",
            "conditionConfidence": 0.88,
            "causeLabel": "None",
            "causeConfidence": 0.90
        }

def get_audio_analysis_service() -> AudioAnalysisService:
    """
    Factory function to retrieve the AudioAnalysisService instance.
    This makes it easy to replace with the actual ML model by returning a different class instance.
    """
    return HardcodedAudioAnalysisService()
