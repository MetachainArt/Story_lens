BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE TYPE user_role AS ENUM ('teacher', 'student');

CREATE TABLE users (
    id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    teacher_id UUID,
    is_active BOOLEAN DEFAULT 'true' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(teacher_id) REFERENCES users (id)
);

CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_teacher_id ON users (teacher_id);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE sessions (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    location VARCHAR(255),
    date DATE NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);

CREATE TABLE photos (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    original_url VARCHAR(500) NOT NULL,
    edited_url VARCHAR(500),
    title VARCHAR(255),
    thumbnail_url VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(session_id) REFERENCES sessions (id),
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX idx_photos_session_id ON photos (session_id);
CREATE INDEX idx_photos_user_id ON photos (user_id);

CREATE TABLE edit_history (
    id UUID NOT NULL,
    photo_id UUID NOT NULL,
    filter_name VARCHAR(50),
    adjustments JSONB,
    crop_data JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(photo_id) REFERENCES photos (id)
);

CREATE INDEX idx_edit_history_photo_id ON edit_history (photo_id);

INSERT INTO alembic_version (version_num) VALUES ('001');

ALTER TABLE sessions ADD COLUMN keywords JSON DEFAULT '[]'::json NOT NULL;
ALTER TABLE photos ADD COLUMN topic VARCHAR(100);

UPDATE alembic_version SET version_num='002' WHERE alembic_version.version_num='001';

COMMIT;
