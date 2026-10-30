import assert from 'node:assert/strict';
import { hash, verify } from 'argon2';
import { signupSchema, loginSchema } from '../src/modules/auth/auth.schema';
import { createPostSchema, createCommentSchema } from '../src/modules/post/post.schema';
import { encodeCursor, decodeCursor } from '../src/modules/post/post.service';
import { redis } from '../src/lib/redis';

async function runTests() {
  console.log('🚀 Running Flint Platform Unit & Smoke Tests...\n');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  // ── 1. Auth Schemas ────────────────────────────────────────────────────────
  console.log('📦 Authentication Schemas:');

  await test('signupSchema accepts valid credentials', () => {
    const input = {
      username: 'Alex_River.99',
      email: 'alex@flint.social',
      password: 'SecurePassword123!',
      displayName: 'Alex River',
    };
    const parsed = signupSchema.parse(input);
    assert.equal(parsed.username, 'alex_river.99'); // normalized to lowercase
    assert.equal(parsed.email, 'alex@flint.social');
  });

  await test('signupSchema rejects invalid email format', () => {
    assert.throws(() => {
      signupSchema.parse({
        username: 'validuser',
        email: 'invalid-email',
        password: 'Password123!',
      });
    });
  });

  await test('signupSchema rejects short or weak passwords', () => {
    assert.throws(() => {
      signupSchema.parse({
        username: 'validuser',
        email: 'user@example.com',
        password: 'weak', // too short, no uppercase, no number
      });
    });
  });

  await test('signupSchema rejects invalid characters in username', () => {
    assert.throws(() => {
      signupSchema.parse({
        username: 'bad user!',
        email: 'user@example.com',
        password: 'Password123!',
      });
    });
  });

  await test('loginSchema validates identifier and password', () => {
    const parsed = loginSchema.parse({ identifier: 'user@example.com', password: 'secretpassword' });
    assert.equal(parsed.identifier, 'user@example.com');
  });

  // ── 2. Password Hashing ───────────────────────────────────────────────────
  console.log('\n🔐 Argon2 Security:');

  await test('hashes password securely and verifies match', async () => {
    const rawPassword = 'MySecretPassword123!';
    const hashed = await hash(rawPassword);
    assert.notEqual(hashed, rawPassword);

    const isValid = await verify(hashed, rawPassword);
    assert.equal(isValid, true);

    const isWrong = await verify(hashed, 'WrongPassword123!');
    assert.equal(isWrong, false);
  });

  // ── 3. Post & Comment Schemas ─────────────────────────────────────────────
  console.log('\n📸 Post & Comment Validation:');

  await test('createPostSchema accepts valid post input', () => {
    const post = createPostSchema.parse({
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      aspectRatio: 'SQUARE',
      caption: 'Golden hour lights #vibes #nature',
      tags: ['vibes', 'nature'],
    });
    assert.equal(post.mediaType, 'IMAGE');
    assert.equal(post.aspectRatio, 'SQUARE');
  });

  await test('createPostSchema rejects invalid aspect ratio', () => {
    assert.throws(() => {
      createPostSchema.parse({
        mediaType: 'IMAGE',
        mediaUrl: 'https://images.unsplash.com/sample',
        aspectRatio: 'ULTRAWIDE' as any,
      });
    });
  });

  await test('createCommentSchema validates content length', () => {
    const comment = createCommentSchema.parse({ content: 'Beautiful capture!' });
    assert.equal(comment.content, 'Beautiful capture!');

    assert.throws(() => {
      createCommentSchema.parse({ content: '' }); // empty comment rejected
    });
  });

  // ── 4. Cursor Pagination Helper ───────────────────────────────────────────
  console.log('\n📄 Cursor Pagination:');

  await test('encodes and decodes cursor correctly', () => {
    const now = new Date();
    const id = 'cm1234567890';
    const encoded = encodeCursor(id, now);
    assert.ok(typeof encoded === 'string');

    const decoded = decodeCursor(encoded);
    assert.ok(decoded !== null);
    assert.equal(decoded.id, id);
    assert.equal(new Date(decoded.createdAt).getTime(), now.getTime());
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  redis.disconnect();
  console.log(`\n================================`);
  console.log(`Tests finished: ${passed} passed, ${failed} failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
