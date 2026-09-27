"""Hand corrections for things the extractor can't infer from the PDF."""

# Song id → ISO 639-1 code, where the stop-word guesser gets it wrong.
LANGUAGE = {
    "a-a-a-valete-studia": "la",
    "filia-pastoris": "la",  # verses in Latin, Greek, German, Polish, Dutch; starts in Latin
    "hava-nagiela": "he",
    "die-kat-kwam-weer": "af",
    "sarie-marais": "af",
}


def apply(songs: list) -> list[str]:
    """Apply overrides in place; return warnings for ids that no longer exist."""
    by_id = {s.id: s for s in songs}
    warnings = []
    for song_id, lang in LANGUAGE.items():
        if song_id in by_id:
            by_id[song_id].language = lang
        else:
            warnings.append(f"override for unknown song id {song_id!r}")
    return warnings
