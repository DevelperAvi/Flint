-- ============================================================
-- Flint Platform — Raw PostgreSQL DDL
-- (mirrors the Prisma schema for reference / direct execution)
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid generation

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE aspect_ratio AS ENUM ('SQUARE', 'PORTRAIT', 'REEL', 'LANDSCAPE');
CREATE TYPE processing_status AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE notification_type AS ENUM ('LIKE', 'COMMENT', 'REPLY', 'FOLLOW', 'MENTION');

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username         VARCHAR(30)  NOT NULL UNIQUE,
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    TEXT         NOT NULL,
    display_name     VARCHAR(60),
    avatar_url       TEXT,
    bio              VARCHAR(160),
    website          VARCHAR(255),
    is_verified      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_private       BOOLEAN      NOT NULL DEFAULT FALSE,
    posts_count      INTEGER      NOT NULL DEFAULT 0,
    followers_count  INTEGER      NOT NULL DEFAULT 0,
    following_count  INTEGER      NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_created  ON users(created_at DESC);
-- Trigram index for fuzzy username search
CREATE INDEX idx_users_username_trgm ON users USING GIN (username gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- REFRESH TOKENS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent TEXT,
    ip_address VARCHAR(45)
);

CREATE INDEX idx_refresh_tokens_user_id   ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires   ON refresh_tokens(expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- POSTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE posts (
    id                TEXT             PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id           TEXT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type        media_type       NOT NULL,
    media_url         TEXT             NOT NULL,
    thumbnail_url     TEXT,
    caption           VARCHAR(2200),
    aspect_ratio      aspect_ratio     NOT NULL DEFAULT 'SQUARE',
    duration          FLOAT,
    width             INTEGER,
    height            INTEGER,
    file_size         BIGINT,
    likes_count       INTEGER          NOT NULL DEFAULT 0,
    comments_count    INTEGER          NOT NULL DEFAULT 0,
    views_count       INTEGER          NOT NULL DEFAULT 0,
    is_archived       BOOLEAN          NOT NULL DEFAULT FALSE,
    processing_status processing_status NOT NULL DEFAULT 'PENDING',
    created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_user_created    ON posts(user_id, created_at DESC);
CREATE INDEX idx_posts_created         ON posts(created_at DESC);
CREATE INDEX idx_posts_processing      ON posts(processing_status);
CREATE INDEX idx_posts_active          ON posts(is_archived, created_at DESC) WHERE is_archived = FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- FOLLOWS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE follows (
    follower_id  TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX idx_follows_follower  ON follows(follower_id, created_at DESC);
CREATE INDEX idx_follows_following ON follows(following_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- LIKES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE likes (
    user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    TEXT        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_likes_post    ON likes(post_id, created_at DESC);
CREATE INDEX idx_likes_user    ON likes(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE comments (
    id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    post_id     TEXT        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id   TEXT        REFERENCES comments(id) ON DELETE CASCADE,
    content     VARCHAR(2200) NOT NULL,
    likes_count INTEGER     NOT NULL DEFAULT 0,
    is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_post   ON comments(post_id, created_at DESC);
CREATE INDEX idx_comments_parent ON comments(parent_id, created_at ASC) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_user   ON comments(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TAGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE tags (
    id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name        VARCHAR(100) NOT NULL UNIQUE,
    posts_count INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_name       ON tags(name);
CREATE INDEX idx_tags_popularity ON tags(posts_count DESC);
CREATE INDEX idx_tags_name_trgm  ON tags USING GIN (name gin_trgm_ops);

CREATE TABLE post_tags (
    post_id    TEXT        NOT NULL REFERENCES posts(id)  ON DELETE CASCADE,
    tag_id     TEXT        NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SAVED POSTS (bookmarks)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE saved_posts (
    user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    TEXT        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_saved_user ON saved_posts(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id           TEXT              PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recipient_id TEXT              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id     TEXT              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         notification_type NOT NULL,
    post_id      TEXT              REFERENCES posts(id) ON DELETE CASCADE,
    comment_id   TEXT              REFERENCES comments(id) ON DELETE CASCADE,
    is_read      BOOLEAN           NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE stories (
    id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_url     TEXT        NOT NULL,
    media_type    media_type  NOT NULL,
    thumbnail_url TEXT,
    duration      FLOAT,
    views_count   INTEGER     NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stories_user    ON stories(user_id, expires_at);
CREATE INDEX idx_stories_expires ON stories(expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS: auto-update updated_at timestamps
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_posts_updated    BEFORE UPDATE ON posts    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS: maintain denormalized counts for fast reads
-- ─────────────────────────────────────────────────────────────────────────────

-- Posts count on users
CREATE OR REPLACE FUNCTION update_posts_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users SET posts_count = posts_count + 1 WHERE id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE users SET posts_count = posts_count - 1 WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_count
    AFTER INSERT OR DELETE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_posts_count();

-- Likes count on posts
CREATE OR REPLACE FUNCTION update_likes_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_likes_count
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_likes_count();

-- Comments count on posts
CREATE OR REPLACE FUNCTION update_comments_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NULL THEN
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NULL THEN
        UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comments_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_comments_count();

-- Followers/following counts
CREATE OR REPLACE FUNCTION update_follow_counts() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users SET following_count  = following_count  + 1 WHERE id = NEW.follower_id;
        UPDATE users SET followers_count  = followers_count  + 1 WHERE id = NEW.following_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE users SET following_count  = GREATEST(following_count  - 1, 0) WHERE id = OLD.follower_id;
        UPDATE users SET followers_count  = GREATEST(followers_count  - 1, 0) WHERE id = OLD.following_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_follow_counts
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Tag post count
CREATE OR REPLACE FUNCTION update_tag_posts_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET posts_count = posts_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET posts_count = GREATEST(posts_count - 1, 0) WHERE id = OLD.tag_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tag_posts_count
    AFTER INSERT OR DELETE ON post_tags
    FOR EACH ROW EXECUTE FUNCTION update_tag_posts_count();
