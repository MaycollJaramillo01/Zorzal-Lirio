import type { RequestHandler } from 'express';
import {
  archiveOrderSchema,
  createNoteSchema,
  createOrderSchema,
  orderFiltersSchema,
  reassignOrderSchema,
  transitionOrderSchema,
  updateOrderFinanceSchema,
  updateOrderSchema,
} from '../../shared/schemas/orders.js';
import { paginationSchema, uuidSchema } from '../../shared/schemas/common.js';
import { parseInput } from '../utils/validate.js';
import { sendOk } from '../utils/apiResponse.js';
import { clientIp, getAuth } from '../middleware/auth.js';
import {
  archiveOrder,
  createOrder,
  getOrderDetail,
  getOrderHistory,
  listOrders,
  reassignOrder,
  restoreOrder,
  transitionOrder,
  updateOrder,
  updateOrderFinance,
} from '../services/orderService.js';
import { addOrderNote, hideOrderNote, listOrderNotes } from '../services/noteService.js';
import { getOrderAudit } from '../services/auditService.js';

export const getOrders: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const filters = parseInput(orderFiltersSchema, req.query);
  sendOk(res, { orders: await listOrders(auth.user, filters) });
};

export const getOrder: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  sendOk(res, await getOrderDetail(auth.user, id));
};

export const postOrder: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const input = parseInput(createOrderSchema, req.body);
  sendOk(res, await createOrder(auth.user, input, clientIp(req)), 201);
};

export const patchOrder: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(updateOrderSchema, req.body);
  sendOk(res, await updateOrder(auth.user, id, input, clientIp(req)));
};

export const patchOrderFinance: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(updateOrderFinanceSchema, req.body);
  sendOk(res, await updateOrderFinance(auth.user, id, input, clientIp(req)));
};

export const postTransition: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(transitionOrderSchema, req.body);
  sendOk(res, await transitionOrder(auth.user, id, input, clientIp(req)));
};

export const postReassign: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(reassignOrderSchema, req.body);
  sendOk(res, await reassignOrder(auth.user, id, input, clientIp(req)));
};

export const postArchive: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(archiveOrderSchema, req.body);
  sendOk(res, await archiveOrder(auth.user, id, input, clientIp(req)));
};

export const postRestore: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(archiveOrderSchema, req.body);
  sendOk(res, await restoreOrder(auth.user, id, input, clientIp(req)));
};

export const getHistory: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  sendOk(res, { history: await getOrderHistory(auth.user, id) });
};

export const getAudit: RequestHandler = async (req, res) => {
  const id = parseInput(uuidSchema, req.params.id);
  const { page, pageSize } = parseInput(paginationSchema, req.query);
  const { items, total } = await getOrderAudit(id, page, pageSize);
  sendOk(res, { items, page, pageSize, total });
};

export const getNotes: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  sendOk(res, { notes: await listOrderNotes(auth.user, id) });
};

export const postNote: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(createNoteSchema, req.body);
  sendOk(res, { notes: await addOrderNote(auth.user, id, input, clientIp(req)) }, 201);
};

export const postHideNote: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const orderId = parseInput(uuidSchema, req.params.orderId);
  const noteId = parseInput(uuidSchema, req.params.noteId);
  sendOk(res, { notes: await hideOrderNote(auth.user, orderId, noteId, clientIp(req)) });
};
