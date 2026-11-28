// constants/campaign.constants.js
// Email campaigns: contact states, campaign lifecycle, schedules and limits.

const CONTACT_STATUS = Object.freeze({
  SUBSCRIBED: "subscribed",
  UNSUBSCRIBED: "unsubscribed",
  BOUNCED: "bounced",
});

const CONTACT_SOURCE = Object.freeze({
  NEWSLETTER: "newsletter",
  IMPORT: "import",
  CUSTOMER: "customer",
  MANUAL: "manual",
});

const CAMPAIGN_KIND = Object.freeze({
  ONE_TIME: "one_time",
  RECURRING: "recurring",
});

// active/paused are recurring-only; scheduled/sending/sent are one-time only.
const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  SENDING: "sending",
  SENT: "sent",
  ACTIVE: "active",
  PAUSED: "paused",
});

const RUN_STATUS = Object.freeze({
  QUEUED: "queued",
  SENDING: "sending",
  COMPLETED: "completed",
  FAILED: "failed",
});

const AUDIENCE_TYPE = Object.freeze({
  ALL: "all",
  LISTS: "lists",
  CONTACTS: "contacts",
});

const RECURRENCE_FREQUENCY = Object.freeze({
  WEEKLY: "weekly",
  FORTNIGHTLY: "fortnightly",
  MONTHLY: "monthly",
});

const DELIVERY_RESULT = Object.freeze({
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
});

const CAMPAIGN_JOB = Object.freeze({
  FANOUT: "campaign_fanout",
  SEND: "campaign_send",
  TEST: "campaign_test",
  SWEEP: "campaign_schedule_sweep",
  FOLLOW_UP_SWEEP: "follow_up_sweep",
  FOLLOW_UP_SEND: "follow_up_send",
});

// Day 29-31 doesn't exist every month, so monthly sends cap at the 28th.
const MAX_MONTHLY_DAY = 28;
const DEFAULT_TIMEZONE = "Australia/Sydney";

const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const IMPORT_MAX_ROWS = 50000;
const IMPORT_CHUNK_SIZE = 500;
const FANOUT_CHUNK_SIZE = 500;
const SWEEP_BATCH_SIZE = 20;
const EXPORT_MAX_ROWS = 200000;

const LIST_NAME_MAX = 60;
const MAX_LISTS_PER_CONTACT = 20;

// Lower-cased header text mapped to a contact field, so most sheets just work.
const IMPORT_HEADER_ALIASES = Object.freeze({
  email: "email",
  "email address": "email",
  "e-mail": "email",
  "first name": "first_name",
  firstname: "first_name",
  "given name": "first_name",
  "last name": "last_name",
  lastname: "last_name",
  surname: "last_name",
  "family name": "last_name",
  name: "name",
  "full name": "name",
  list: "lists",
  lists: "lists",
  tags: "lists",
});

// Email builder blocks; "columns" holds leaf blocks, never another column.
const DESIGN_BLOCK = Object.freeze({
  HEADING: "heading",
  TEXT: "text",
  BUTTON: "button",
  IMAGE: "image",
  LOGO: "logo",
  DIVIDER: "divider",
  SPACER: "spacer",
  PRODUCTS: "products",
  SOCIAL: "social",
  COLUMNS: "columns",
});

const DESIGN_LEAF_BLOCKS = Object.freeze([
  DESIGN_BLOCK.HEADING,
  DESIGN_BLOCK.TEXT,
  DESIGN_BLOCK.BUTTON,
  DESIGN_BLOCK.IMAGE,
  DESIGN_BLOCK.DIVIDER,
  DESIGN_BLOCK.SPACER,
]);

// Web-safe stacks only: email clients ignore web fonts almost everywhere.
const DESIGN_FONTS = Object.freeze({
  arial: "Arial, Helvetica, sans-serif",
  helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  verdana: "Verdana, Geneva, sans-serif",
  trebuchet: "'Trebuchet MS', Tahoma, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  times: "'Times New Roman', Times, serif",
});

const SOCIAL_NETWORKS = Object.freeze(["facebook", "instagram", "x", "youtube", "tiktok", "linkedin", "website"]);

const DESIGN_LIMITS = Object.freeze({
  MAX_BLOCKS: 60,
  MAX_COLUMN_BLOCKS: 8,
  MAX_PRODUCTS: 6,
  MAX_SOCIAL_LINKS: 7,
  MIN_WIDTH: 480,
  MAX_WIDTH: 720,
});

const MAX_SELECTED_CONTACTS = 500;
const MAX_TEMPLATES = 100;

// Merge tags staff can drop into a campaign body or subject.
const MERGE_TAGS = Object.freeze(["first_name", "last_name", "email"]);

module.exports = {
  CONTACT_STATUS,
  CONTACT_SOURCE,
  CAMPAIGN_KIND,
  CAMPAIGN_STATUS,
  RUN_STATUS,
  AUDIENCE_TYPE,
  RECURRENCE_FREQUENCY,
  DELIVERY_RESULT,
  CAMPAIGN_JOB,
  MAX_MONTHLY_DAY,
  DEFAULT_TIMEZONE,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_CHUNK_SIZE,
  FANOUT_CHUNK_SIZE,
  SWEEP_BATCH_SIZE,
  EXPORT_MAX_ROWS,
  LIST_NAME_MAX,
  MAX_LISTS_PER_CONTACT,
  IMPORT_HEADER_ALIASES,
  MERGE_TAGS,
  DESIGN_BLOCK,
  DESIGN_LEAF_BLOCKS,
  DESIGN_FONTS,
  SOCIAL_NETWORKS,
  DESIGN_LIMITS,
  MAX_SELECTED_CONTACTS,
  MAX_TEMPLATES,
};
