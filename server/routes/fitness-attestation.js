import { Router } from 'express';
import { userGuard } from '../middleware/auth.js';
import { fitnessAttestationService } from '../domain/fitness-attestation.js';

export function createFitnessAttestationRouter({ service = fitnessAttestationService } = {}) {
  const router = Router();
  router.use('/api/fitness/attestation', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  router.post('/api/fitness/attestation/challenges', userGuard, (req, res) => {
    if (req.user.role !== 'guest' || req.user.verified !== 1) {
      return res.status(403).json({ error: 'verified_guest_required' });
    }
    const purpose = req.body?.purpose;
    if (purpose !== 'attestation' && purpose !== 'assertion') {
      return res.status(400).json({ error: 'invalid_challenge_purpose' });
    }
    const result = service.issueChallenge({
      customerId: req.user.id,
      purpose,
      keyId: req.body?.keyId,
      requestHash: req.body?.requestHash,
    });
    if (!result.ok) {
      const status = result.reason === 'rate_limited' ? 429
        : result.reason === 'customer_not_eligible' || result.reason === 'key_not_registered' ? 403
          : 400;
      return res.status(status).json({ error: result.reason });
    }
    return res.status(201).json({
      challengeId: result.challengeId,
      challenge: result.challenge,
      purpose: result.purpose,
      expiresAt: result.expiresAt,
    });
  });

  return router;
}
