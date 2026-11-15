import { Router } from 'express';
import { userGuard } from '../middleware/auth.js';
import { fitnessEvidenceService } from '../domain/fitness-evidence.js';

export function createFitnessEvidenceRouter({ service = fitnessEvidenceService } = {}) {
  const router = Router();
  router.use('/api/fitness/evidence', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  router.post('/api/fitness/evidence', userGuard, (req, res) => {
    if (req.user.role !== 'guest' || req.user.verified !== 1) {
      return res.status(403).json({ error: 'verified_guest_required' });
    }
    const result = service.submitDeviceEvidence({
      customerId: req.user.id,
      activity: req.body?.activity,
    });
    if (!result.ok) {
      const status = result.reason === 'customer_not_eligible' ? 403
        : result.reason === 'rate_limited' ? 429 : 400;
      return res.status(status).json({ error: result.reason });
    }
    return res.status(result.duplicate ? 200 : 202).json({
      id: result.id,
      duplicate: result.duplicate,
      sourcePlatform: result.sourcePlatform,
      evidenceState: result.evidenceState,
      verificationState: result.verificationState,
      reward: null,
    });
  });

  return router;
}
