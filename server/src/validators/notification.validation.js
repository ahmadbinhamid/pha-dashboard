// validators/notification.validation.js

const Joi = require("joi");
const { NOTIFICATION_CATEGORY_TYPES, NOTIFICATION_EVENT } = require("../constants/notification.constants");

const categoryField = Joi.string().valid(...Object.keys(NOTIFICATION_CATEGORY_TYPES));

const byIdParam = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

const listNotifications = {
  query: Joi.object({ category: categoryField }),
};

const markAllAsRead = {
  query: Joi.object({ category: categoryField }),
};

const updatePreferences = {
  body: Joi.object({
    events: Joi.object(
      Object.fromEntries(Object.values(NOTIFICATION_EVENT).map((key) => [key, Joi.boolean()])),
    ),
    show_toasts: Joi.boolean(),
  }).min(1),
};

module.exports = { byIdParam, listNotifications, markAllAsRead, updatePreferences };
