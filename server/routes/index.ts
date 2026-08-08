import { Router } from 'express';
import { attachAuth, requireAuth, requireManager, requirePasswordUpToDate } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import {
  getMe,
  postChangePassword,
  postLogin,
  postLogout,
} from '../controllers/authController.js';
import {
  getUser,
  getUsers,
  patchUser,
  postActivate,
  postDeactivate,
  postResetPassword,
  postUser,
  putStageFocus,
} from '../controllers/userController.js';
import { getStagesHandler, patchStageSla } from '../controllers/stageController.js';
import {
  getAudit,
  getHistory,
  getNotes,
  getOrder,
  getOrders,
  patchOrder,
  patchOrderFinance,
  postArchive,
  postHideNote,
  postNote,
  postOrder,
  postReassign,
  postRestore,
  postTransition,
} from '../controllers/orderController.js';
import {
  getExport,
  getFinancial,
  getOverdue,
  getStageTimes,
  getSummary,
  getThroughput,
  getWorkload,
} from '../controllers/reportController.js';
import { getCronSla, getHealth } from '../controllers/systemController.js';

export function buildApiRouter(): Router {
  const router = Router();

  router.get('/health', getHealth);
  router.get('/cron/sla', getCronSla);

  router.use(attachAuth);

  // Rutas de sesion: accesibles aunque el usuario deba cambiar su contrasena.
  router.post('/auth/login', loginRateLimiter, postLogin);
  router.post('/auth/logout', postLogout);
  router.get('/auth/me', requireAuth, getMe);
  router.post('/auth/change-password', requireAuth, postChangePassword);

  router.use(requireAuth, requirePasswordUpToDate);

  router.get('/users', getUsers);
  router.post('/users', requireManager, postUser);
  router.get('/users/:id', requireManager, getUser);
  router.patch('/users/:id', requireManager, patchUser);
  router.post('/users/:id/reset-password', requireManager, postResetPassword);
  router.post('/users/:id/activate', requireManager, postActivate);
  router.post('/users/:id/deactivate', requireManager, postDeactivate);
  router.put('/users/:id/stage-focus', requireManager, putStageFocus);

  router.get('/stages', getStagesHandler);
  router.patch('/stages/:id/sla', requireManager, patchStageSla);

  router.get('/orders', getOrders);
  router.post('/orders', requireManager, postOrder);
  router.get('/orders/:id', getOrder);
  router.patch('/orders/:id', requireManager, patchOrder);
  router.patch('/orders/:id/finance', requireManager, patchOrderFinance);
  router.post('/orders/:id/transition', postTransition);
  router.post('/orders/:id/reassign', requireManager, postReassign);
  router.post('/orders/:id/archive', requireManager, postArchive);
  router.post('/orders/:id/restore', requireManager, postRestore);

  router.get('/orders/:id/notes', getNotes);
  router.post('/orders/:id/notes', postNote);
  router.post('/orders/:orderId/notes/:noteId/hide', requireManager, postHideNote);

  router.get('/orders/:id/history', getHistory);
  router.get('/orders/:id/audit', requireManager, getAudit);

  router.get('/reports/summary', getSummary);
  router.get('/reports/workload', requireManager, getWorkload);
  router.get('/reports/overdue', requireManager, getOverdue);
  router.get('/reports/stage-times', requireManager, getStageTimes);
  router.get('/reports/throughput', requireManager, getThroughput);
  router.get('/reports/financial', requireManager, getFinancial);
  router.get('/reports/export', requireManager, getExport);

  return router;
}
