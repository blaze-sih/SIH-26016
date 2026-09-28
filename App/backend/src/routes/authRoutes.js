/**
 * LRVS — Auth Routes
 * Team BLAZE | SIH26016
 *
 * No public registration. Users are created by SUPER_ADMIN only.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { login, me, logout, createUser, register } = require('../controllers/authController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// POST /api/auth/register — API client user registration
router.post('/register', register);

// POST /api/auth/login — ID + Password login (JSON API)
router.post('/login', login);

// GET /api/auth/me — Get current authenticated user
router.get('/me', authenticateUser, me);

// POST /api/auth/logout — Logout (clears cookie + JWT stateless)
router.post('/logout', authenticateUser, logout);

// POST /api/auth/users — Admin-only: provision a new user account
router.post(
  '/users',
  authenticateUser,
  authorizeRoles('SUPER_ADMIN'),
  createUser
);

module.exports = router;
