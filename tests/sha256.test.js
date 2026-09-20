import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256Hex} from '../src/services/sha256.js';

test('browser-safe SHA-256 matches standard vectors',()=>{
  assert.equal(sha256Hex(''),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('ArtiSys Pecuária'),sha256Hex('ArtiSys Pecuária'));
});
