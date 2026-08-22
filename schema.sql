-- ============================================================
-- Music Rating App — PostgreSQL Schema
-- ============================================================
-- Design notes:
-- - "Polymorphic" pattern used for ratings, likes, list_items,
--   and favorites: an entity_type + entity_id pair lets one table
--   handle albums/songs/artists instead of duplicating logic 3x.
-- - Postgres can't enforce a polymorphic FK natively, so integrity
--   is enforced at the application layer (or via CHECK constraints
--   + triggers if you want to get fancy later — not needed for v1).
-- - Half-star ratings stored as SMALLINT counting half-points
--   (1-10 = 0.5-5.0 stars), avoiding float rounding issues.
-- ============================================================

CREATE TYPE entity_type AS ENUM ('album', 'song', 'artist');
CREATE TYPE favorite_type AS ENUM ('album', 'song', 'artist');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(30) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(50),
    bio             VARCHAR(280),
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ARTISTS / ALBUMS / SONGS
-- (populate from Spotify/MusicBrainz API rather than by hand)
-- ============================================================
CREATE TABLE artists (
    id              SERIAL PRIMARY KEY,
    external_id     VARCHAR(64) UNIQUE,     -- Spotify/MusicBrainz ID for syncing
    name            VARCHAR(200) NOT NULL,
    image_url       TEXT,
    bio             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE albums (
    id              SERIAL PRIMARY KEY,
    external_id     VARCHAR(64) UNIQUE,
    title           VARCHAR(300) NOT NULL,
    cover_url       TEXT,
    release_date    DATE,
    album_type      VARCHAR(20),            -- 'album', 'ep', 'single', 'compilation'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE songs (
    id              SERIAL PRIMARY KEY,
    external_id     VARCHAR(64) UNIQUE,
    album_id        INTEGER REFERENCES albums(id) ON DELETE SET NULL,
    title           VARCHAR(300) NOT NULL,
    track_number    SMALLINT,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many: an album/song can have multiple artists (collabs, features)
CREATE TABLE album_artists (
    album_id        INTEGER REFERENCES albums(id) ON DELETE CASCADE,
    artist_id       INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'primary',   -- 'primary', 'featured'
    PRIMARY KEY (album_id, artist_id)
);

CREATE TABLE song_artists (
    song_id         INTEGER REFERENCES songs(id) ON DELETE CASCADE,
    artist_id       INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'primary',
    PRIMARY KEY (song_id, artist_id)
);

-- Credits: producers, songwriters, engineers, etc.
-- Uses entity_type/entity_id so one table covers both songs and albums.
CREATE TABLE credits (
    id              SERIAL PRIMARY KEY,
    entity_type     entity_type NOT NULL CHECK (entity_type IN ('album', 'song')),
    entity_id       INTEGER NOT NULL,
    artist_id       INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL   -- 'producer', 'songwriter', 'engineer', etc.
);
CREATE INDEX idx_credits_entity ON credits(entity_type, entity_id);

-- ============================================================
-- FAVORITES — the "top 4" grid, like Letterboxd's 4 favorite films
-- ============================================================
CREATE TABLE favorites (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    favorite_type   favorite_type NOT NULL,   -- 'album', 'song', or 'artist'
    entity_id       INTEGER NOT NULL,
    position        SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 4),
    -- one slot per (user, type, position) — e.g. 4 favorite albums, 4 favorite songs, 4 favorite artists
    UNIQUE (user_id, favorite_type, position)
);

-- ============================================================
-- RATINGS — 5 stars, half-star increments
-- stored as half-point integers: 1 = 0.5 stars ... 10 = 5.0 stars
-- ============================================================
CREATE TABLE ratings (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type     entity_type NOT NULL CHECK (entity_type IN ('album', 'song')),
    entity_id       INTEGER NOT NULL,
    score           SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, entity_type, entity_id)   -- one rating per user per item
);
CREATE INDEX idx_ratings_entity ON ratings(entity_type, entity_id);

-- ============================================================
-- REVIEWS — separate from ratings since a review is optional text,
-- and you may want to allow editing/deleting reviews independently
-- ============================================================
CREATE TABLE reviews (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type     entity_type NOT NULL CHECK (entity_type IN ('album', 'song')),
    entity_id       INTEGER NOT NULL,
    rating_id       INTEGER REFERENCES ratings(id) ON DELETE SET NULL,  -- optional link to a rating
    body            TEXT NOT NULL,
    contains_spoilers BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_entity ON reviews(entity_type, entity_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

-- ============================================================
-- LIKES — quick "heart" on a song or album
-- ============================================================
CREATE TABLE likes (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type     entity_type NOT NULL CHECK (entity_type IN ('album', 'song')),
    entity_id       INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, entity_type, entity_id)
);
CREATE INDEX idx_likes_entity ON likes(entity_type, entity_id);

-- ============================================================
-- LISTS — user-curated lists that can hold albums, songs, or artists
-- ============================================================
CREATE TABLE lists (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(150) NOT NULL,
    description     TEXT,
    is_ranked       BOOLEAN NOT NULL DEFAULT false,   -- ordered (Top 10) vs unordered collection
    is_public       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE list_items (
    id              SERIAL PRIMARY KEY,
    list_id         INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    entity_type     entity_type NOT NULL,   -- album, song, or artist
    entity_id       INTEGER NOT NULL,
    position         INTEGER,               -- nullable; used only if list.is_ranked
    note            VARCHAR(280),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (list_id, entity_type, entity_id)
);

-- ============================================================
-- FOLLOWS — social graph
-- ============================================================
CREATE TABLE follows (
    follower_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id != followee_id)
);

-- ============================================================
-- RECOMMENDATIONS — sending an album/song to a friend
-- ============================================================
CREATE TABLE recommendations (
    id              SERIAL PRIMARY KEY,
    sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type     entity_type NOT NULL CHECK (entity_type IN ('album', 'song')),
    entity_id       INTEGER NOT NULL,
    note            VARCHAR(280),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read         BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_recommendations_recipient ON recommendations(recipient_id, is_read);

-- ============================================================
-- ACTIVITY FEED
-- Rather than a separate "activities" table that duplicates data,
-- the feed is best built as a UNION query across ratings/reviews/
-- likes/lists/follows, ordered by created_at, filtered to people
-- the current user follows. See feed query note below.
-- ============================================================

-- Optional: if the UNION query gets too slow at scale, materialize
-- into this table via triggers (fan-out on write) instead of
-- computing the feed on every read (fan-out on read).
CREATE TABLE activities (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type   VARCHAR(20) NOT NULL,   -- 'rating', 'review', 'like', 'list', 'follow'
    entity_type     entity_type,
    entity_id       INTEGER,
    reference_id    INTEGER,                -- id of the rating/review/list row, for linking
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_user_created ON activities(user_id, created_at DESC);
