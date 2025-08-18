# nlp_utils.py
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import nltk

# Ensure vader lexicon exists
try:
    _ = SentimentIntensityAnalyzer()
except Exception:
    nltk.download("vader_lexicon")
    _ = SentimentIntensityAnalyzer()

sia = SentimentIntensityAnalyzer()


def analyze_sentiment(text):
    """
    Returns a dict: {label: 'positive'/'neutral'/'negative', score: compound float, word_count: int}
    """
    text = text or ""
    scores = sia.polarity_scores(text)
    compound = scores.get("compound", 0.0)
    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    word_count = len(text.split())
    return {"label": label, "score": compound, "word_count": word_count}
