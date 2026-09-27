"""Tiny stop-word language guesser for songs outside the single-language sections."""

import re

STOPWORDS = {
    "nl": "de het een en van ik je jij wij we zijn is niet op in met die dat voor maar als er ons ze zo nog wat",
    "fr": "le la les un une et de des du je tu il nous vous est pas que qui dans pour sur au aux ne ce mon ma",
    "de": "der die das und ein eine ich du wir ist nicht mit dem den zu auf im sich auch wie so mein",
    "en": "the and a of to i you we is in it my on for with that are be all me your our",
    "la": "et in est non ad cum sunt nos vos qui quae quod nobis vivat vivant sed ut",
    "af": "die en 'n is nie ek jy ons my van vir met op sy hulle wat daar",
    "es": "el la los las y de que en un una es no por con para mi yo",
    "it": "il la le e di che non un una per con mi io sono del",
}
_SETS = {lang: set(words.split()) for lang, words in STOPWORDS.items()}


def detect_language(text: str, default: str = "nl") -> str:
    words = re.findall(r"[\w']+", text.lower())
    if not words:
        return default
    scores = {lang: sum(w in s for w in words) for lang, s in _SETS.items()}
    best = max(scores, key=scores.__getitem__)
    return best if scores[best] > 0 else default
