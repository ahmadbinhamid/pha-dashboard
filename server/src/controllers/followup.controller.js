// controllers/followup.controller.js

const followUpService = require("../services/followup/follow-up.service");
const feedbackService = require("../services/followup/feedback.service");
const { systemfailure } = require("../utils/http/response");
const { handle, toPage } = require("../utils/http/handle");
const { renderSimplePage } = require("../utils/http/htmlPage");

exports.listFollowUps = handle((req) => followUpService.listFollowUps(req.tenantId));
exports.getFollowUp = handle((req) => followUpService.getFollowUp(req.params.id, req.tenantId));
exports.createFollowUp = handle((req) => followUpService.createFollowUp(req.tenantId, req.body), {
  message: "Follow-up created",
  status: "created",
});
exports.updateFollowUp = handle((req) => followUpService.updateFollowUp(req.params.id, req.tenantId, req.body), {
  message: "Follow-up saved",
});
exports.setEnabled = handle((req) => followUpService.setFollowUpEnabled(req.params.id, req.tenantId, req.body.enabled), {
  message: "Follow-up updated",
});
exports.deleteFollowUp = handle((req) => followUpService.deleteFollowUp(req.params.id, req.tenantId), { message: "Follow-up deleted" });
exports.previewFollowUp = handle((req) => followUpService.previewFollowUp(req.tenantId, req.body));

exports.listFeedback = handle(async (req) => {
  const { limit, skip } = req.pagination;
  const { search, rating, max_rating: maxRating } = req.query;
  return toPage(req.pagination, await feedbackService.listFeedback(req.tenantId, { skip, limit, search, rating, maxRating }));
});
exports.getFeedbackStats = handle((req) => feedbackService.getFeedbackStats(req.tenantId));

// ── public (token is the only credential) ──

exports.getFeedbackForm = handle((req) => feedbackService.getFeedbackForm(req.params.token));
exports.submitFeedback = handle((req) => feedbackService.submitFeedback(req.params.token, req.body.ratings), {
  message: "Thanks for your feedback",
});

const INVALID_PAGE = {
  title: "Link expired",
  heading: "This link isn't valid",
  message: "It may be incomplete or out of date. Reply to the email and we'll take you off the list.",
};

// GET never opts out: mail scanners prefetch every link in an email.
exports.optOutPage = async (req, res) => {
  try {
    const info = await feedbackService.describeOptOut(req.params.token);
    if (!info) return res.status(404).type("html").send(renderSimplePage(INVALID_PAGE));
    const page = {
      title: "Stop follow-up emails",
      heading: `Stop emails from ${info.store_name}?`,
      message: `${info.email} won't get follow-ups or newsletters. Order and delivery emails still arrive.`,
      form: { action: req.originalUrl, label: "Stop emails" },
    };
    return res.type("html").send(renderSimplePage(page));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.optOut = async (req, res) => {
  try {
    const { email, store_name: store } = await feedbackService.optOutByToken(req.params.token);
    const message = `${email} won't get follow-ups or newsletters from ${store} again.`;
    return res.type("html").send(renderSimplePage({ title: "Done", heading: "You won't hear from us like this again", message }));
  } catch (err) {
    if (err.status === 404) return res.status(404).type("html").send(renderSimplePage(INVALID_PAGE));
    return systemfailure(res, err);
  }
};
