-- Relational version of song.schema.json / club.schema.json.
-- Plain SQL that runs on both SQLite and PostgreSQL.

CREATE TABLE section (
    id          TEXT PRIMARY KEY,          -- e.g. 'franstalige-liederen'
    title       TEXT NOT NULL,             -- e.g. 'Franstalige liederen'
    position    INTEGER NOT NULL UNIQUE,   -- order in the book
    start_page  INTEGER NOT NULL
);

CREATE TABLE club (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    motto       TEXT,
    description TEXT,
    founded     INTEGER,
    founders    TEXT,                      -- comma-separated; kept simple on purpose
    colours     TEXT                       -- e.g. 'rood–wit–rood'
);

CREATE TABLE song (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    sort_title  TEXT,
    section_id  TEXT NOT NULL REFERENCES section(id),
    language    TEXT NOT NULL,             -- ISO 639-1
    club_id     TEXT REFERENCES club(id),
    page_start  INTEGER NOT NULL,
    page_end    INTEGER NOT NULL,
    lyricist    TEXT,
    melody      TEXT,
    notes       TEXT,
    CHECK (page_end >= page_start)
);

CREATE TABLE stanza (
    song_id     TEXT NOT NULL REFERENCES song(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,          -- 0-based order within the song
    kind        TEXT NOT NULL CHECK (kind IN ('verse', 'chorus', 'chorus-ref', 'direction')),
    repeat      INTEGER NOT NULL DEFAULT 1,
    instruction TEXT,
    PRIMARY KEY (song_id, position)
);

CREATE TABLE line (
    song_id         TEXT NOT NULL,
    stanza_position INTEGER NOT NULL,
    position        INTEGER NOT NULL,      -- 0-based order within the stanza
    text            TEXT NOT NULL,
    PRIMARY KEY (song_id, stanza_position, position),
    FOREIGN KEY (song_id, stanza_position) REFERENCES stanza(song_id, position) ON DELETE CASCADE
);

-- "(BIS)" and friends. from_line = to_line for a marker on a single line.
CREATE TABLE repeat_span (
    song_id         TEXT NOT NULL,
    stanza_position INTEGER NOT NULL,
    from_line       INTEGER NOT NULL,
    to_line         INTEGER NOT NULL,
    times           INTEGER,               -- NULL for non-numeric markers like '(ULB)'
    marker          TEXT NOT NULL,
    PRIMARY KEY (song_id, stanza_position, from_line, to_line),
    FOREIGN KEY (song_id, stanza_position) REFERENCES stanza(song_id, position) ON DELETE CASCADE,
    CHECK (to_line >= from_line)
);

CREATE INDEX song_section_idx ON song(section_id);
CREATE INDEX song_club_idx    ON song(club_id);
CREATE INDEX song_sort_idx    ON song(sort_title);
