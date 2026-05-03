# Database Schema — Nexus OS

> **Gerado automaticamente** por `scripts/gen-schema-docs.js` em 2026-05-03 00:25.
> Não edite à mão. Pra atualizar: `npm run docs:schema`.

**Total:** 34 tabelas.

**Convenções:**
- 🔑 PK = primary key
- 🔗 = foreign key (com tabela de destino e regra de DELETE)
- Schema versionado em `db/schema.sql` (instalação inicial) + `migrations/*.sql` (mudanças incrementais).

## `alert_configs`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('alert_configs_id_seq'::regclass)` |
| `metric` | `text` | NOT NULL | — |
| `channel` | `text` | NOT NULL | `'all'::text` |
| `threshold` | `numeric(14,4)` | NOT NULL | — |
| `direction` | `text` | NOT NULL | `'min'::text` |
| `email` | `text` | NOT NULL | — |
| `active` | `int` | NOT NULL | `1` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `webhook_url` | `text` | — | — |
| `window_days` | `int` | — | `0` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `whatsapp` | `text` | — | — |

## `alert_log`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('alert_log_id_seq'::regclass)` |
| `alert_id` | `int` | 🔗 → `alert_configs.id` (CASCADE), NOT NULL | — |
| `year` | `int` | NOT NULL | — |
| `month` | `int` | NOT NULL | — |
| `value` | `numeric(14,4)` | — | — |
| `sent_at` | `timestamptz` | NOT NULL | `now()` |

### Índices

- `alert_log_alert_id_year_month_key`
- `idx_alert_log_period`

## `audit_log`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `bigint` | 🔑 PK | `nextval('audit_log_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (SET NULL) | — |
| `actor` | `text` | — | — |
| `action` | `text` | NOT NULL | — |
| `details` | `jsonb` | — | `'{}'::jsonb` |
| `ts` | `timestamptz` | NOT NULL | `now()` |
| `user_id` | `int` | — | — |
| `ip` | `varchar(64)` | — | — |

### Índices

- `idx_audit_log_action`
- `idx_audit_log_ts`
- `idx_audit_log_user_ts`
- `idx_audit_log_workspace_ts`

## `automations`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('automations_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `name` | `text` | NOT NULL | — |
| `metric` | `text` | NOT NULL | — |
| `operator` | `text` | NOT NULL | — |
| `value` | `numeric(10,2)` | NOT NULL | — |
| `action` | `text` | NOT NULL | — |
| `active` | `bool` | — | `true` |
| `last_run` | `timestamptz` | — | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

## `campaigns`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('campaigns_id_seq'::regclass)` |
| `channel` | `text` | NOT NULL | — |
| `name` | `text` | NOT NULL | — |
| `objective` | `text` | — | — |
| `status` | `text` | NOT NULL | `'active'::text` |
| `color` | `text` | — | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |

### Índices

- `campaigns_channel_name_key`
- `idx_campaigns_channel`
- `idx_campaigns_status`
- `idx_campaigns_workspace`
- `idx_campaigns_workspace_created`

## `financial_settings`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `workspace_id` | `int` | 🔑 PK, 🔗 → `workspaces.id` (CASCADE) | — |
| `product_cost` | `numeric(10,2)` | — | `0` |
| `tax_rate` | `numeric(5,2)` | — | `0` |
| `gateway_rate` | `numeric(5,2)` | — | `0` |
| `agency_fee` | `numeric(10,2)` | — | `0` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

## `funnels`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('funnels_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `slug` | `varchar(100)` | NOT NULL | — |
| `name` | `varchar(255)` | — | — |
| `niche` | `varchar(100)` | — | — |
| `html_content` | `text` | — | — |
| `visits` | `int` | — | `0` |
| `conversions` | `int` | — | `0` |
| `created_at` | `timestamptz` | — | `now()` |

### Índices

- `funnels_slug_key`
- `idx_funnels_slug`
- `idx_funnels_workspace`

## `goals`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('goals_id_seq'::regclass)` |
| `year` | `int` | NOT NULL | — |
| `month` | `int` | NOT NULL | — |
| `channel` | `text` | NOT NULL | — |
| `metric` | `text` | NOT NULL | — |
| `target` | `numeric(14,4)` | NOT NULL | — |
| `direction` | `text` | NOT NULL | `'min'::text` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |

### Índices

- `goals_year_month_channel_metric_key`
- `idx_goals_period`

## `kanban_tasks`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('kanban_tasks_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `title` | `varchar(255)` | NOT NULL | — |
| `description` | `text` | — | — |
| `status` | `varchar(20)` | — | `'backlog'::character varying` |
| `created_at` | `timestamptz` | — | `now()` |

## `market_buyers`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('market_buyers_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `company_name` | `varchar(100)` | — | — |
| `buyer_phone` | `varchar(50)` | — | — |
| `niche` | `varchar(100)` | — | — |
| `city` | `varchar(100)` | — | — |
| `created_at` | `timestamptz` | — | `now()` |

## `market_leads`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('market_leads_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `niche` | `varchar(100)` | — | — |
| `city` | `varchar(100)` | — | — |
| `lead_name` | `varchar(100)` | — | — |
| `lead_phone` | `varchar(50)` | — | — |
| `captured_cost` | `numeric` | — | `0` |
| `sold_price` | `numeric` | — | `0` |
| `status` | `varchar(50)` | — | `'AVAILABLE'::character varying` |
| `buyer_id` | `int` | — | — |
| `created_at` | `timestamptz` | — | `now()` |

### Índices

- `idx_market_leads_workspace_created`

## `metrics_ads`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('metrics_ads_id_seq'::regclass)` |
| `campaign_id` | `int` | 🔗 → `campaigns.id` (CASCADE), NOT NULL | — |
| `ad_id` | `text` | NOT NULL | — |
| `ad_name` | `text` | — | — |
| `thumbnail_url` | `text` | — | — |
| `date` | `date` | NOT NULL | — |
| `impressions` | `int` | — | `0` |
| `clicks` | `int` | — | `0` |
| `conversions` | `int` | — | `0` |
| `spend` | `numeric(14,2)` | — | `0` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

### Índices

- `idx_metrics_ads_campaign`
- `idx_metrics_ads_date`
- `metrics_ads_campaign_id_ad_id_date_key`

## `metrics_daily`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('metrics_daily_id_seq'::regclass)` |
| `campaign_id` | `int` | 🔗 → `campaigns.id` (CASCADE), NOT NULL | — |
| `date` | `date` | NOT NULL | — |
| `impressions` | `int` | NOT NULL | `0` |
| `clicks` | `int` | NOT NULL | `0` |
| `conversions` | `int` | NOT NULL | `0` |
| `spend` | `numeric(14,2)` | NOT NULL | `0` |
| `revenue` | `numeric(14,2)` | NOT NULL | `0` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |
| `reach` | `int` | NOT NULL | `0` |
| `frequency` | `numeric(8,4)` | NOT NULL | `0` |
| `video_views` | `int` | NOT NULL | `0` |
| `story_views` | `int` | NOT NULL | `0` |
| `reel_plays` | `int` | NOT NULL | `0` |
| `link_clicks` | `int` | NOT NULL | `0` |
| `post_engagement` | `int` | NOT NULL | `0` |
| `sales` | `int` | — | `0` |

### Índices

- `idx_metrics_campaign`
- `idx_metrics_daily_date`
- `idx_metrics_date`
- `metrics_daily_campaign_id_date_key`

## `metrics_demographics`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('metrics_demographics_id_seq'::regclass)` |
| `campaign_id` | `int` | 🔗 → `campaigns.id` (CASCADE), NOT NULL | — |
| `date` | `date` | NOT NULL | — |
| `type` | `text` | NOT NULL | — |
| `dimension` | `text` | NOT NULL | — |
| `impressions` | `bigint` | — | `0` |
| `clicks` | `bigint` | — | `0` |
| `spend` | `numeric(14,4)` | — | `0` |
| `conversions` | `bigint` | — | `0` |

### Índices

- `idx_metrics_demo_type`
- `metrics_demographics_campaign_id_date_type_dimension_key`

## `metrics_placement`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('metrics_placement_id_seq'::regclass)` |
| `campaign_id` | `int` | 🔗 → `campaigns.id` (CASCADE), NOT NULL | — |
| `date` | `date` | NOT NULL | — |
| `platform` | `text` | NOT NULL | — |
| `placement` | `text` | NOT NULL | — |
| `impressions` | `int` | NOT NULL | `0` |
| `clicks` | `int` | NOT NULL | `0` |
| `reach` | `int` | NOT NULL | `0` |
| `video_views` | `int` | NOT NULL | `0` |
| `spend` | `numeric(14,2)` | NOT NULL | `0` |
| `conversions` | `int` | NOT NULL | `0` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

### Índices

- `idx_placement_campaign`
- `idx_placement_date`
- `idx_placement_platform`
- `metrics_placement_campaign_id_date_platform_placement_key`

## `notes`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('notes_id_seq'::regclass)` |
| `year` | `int` | NOT NULL | — |
| `month` | `int` | NOT NULL | — |
| `day` | `int` | — | — |
| `channel` | `text` | — | — |
| `text` | `text` | NOT NULL | — |
| `tag` | `text` | — | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |

### Índices

- `idx_notes_period`

## `orders`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('orders_id_seq'::regclass)` |
| `product_id` | `int` | 🔗 → `products.id` (CASCADE) | — |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `customer_name` | `varchar(255)` | — | — |
| `customer_email` | `varchar(255)` | — | — |
| `customer_phone` | `varchar(50)` | — | — |
| `amount` | `numeric` | — | — |
| `payment_method` | `varchar(50)` | — | — |
| `status` | `varchar(50)` | — | `'PENDING'::character varying` |
| `created_at` | `timestamptz` | — | `now()` |

### Índices

- `idx_orders_workspace_created`

## `pay_transactions`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('pay_transactions_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `client_name` | `varchar(100)` | — | — |
| `amount` | `numeric` | — | — |
| `nexus_fee` | `numeric` | — | — |
| `net_amount` | `numeric` | — | — |
| `status` | `varchar(50)` | — | `'PENDING'::character varying` |
| `pix_code` | `varchar(255)` | — | — |
| `created_at` | `timestamptz` | — | `now()` |

## `payments_log`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `bigint` | 🔑 PK | `nextval('payments_log_id_seq'::regclass)` |
| `payment_id` | `varchar(255)` | NOT NULL | — |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (NO ACTION), NOT NULL | — |
| `plan` | `varchar(50)` | NOT NULL | — |
| `amount` | `numeric(10,2)` | NOT NULL | — |
| `status` | `varchar(50)` | NOT NULL | — |
| `timestamp` | `timestamptz` | — | `now()` |

### Índices

- `idx_payments_log_payment_id`
- `idx_payments_log_workspace`

## `pixel_events`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('pixel_events_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `event_type` | `text` | NOT NULL | — |
| `url` | `text` | — | — |
| `utm_source` | `text` | — | — |
| `utm_medium` | `text` | — | — |
| `utm_campaign` | `text` | — | — |
| `utm_term` | `text` | — | — |
| `utm_content` | `text` | — | — |
| `click_id` | `text` | — | — |
| `revenue` | `numeric(10,2)` | — | `0` |
| `ip_address` | `text` | — | — |
| `user_agent` | `text` | — | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

### Índices

- `idx_pixel_events_workspace_created`

## `pixel_journeys`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('pixel_journeys_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `visitor_id` | `varchar(100)` | NOT NULL | — |
| `ip_address` | `varchar(50)` | — | — |
| `user_agent` | `text` | — | — |
| `utm_source` | `varchar(255)` | — | — |
| `utm_medium` | `varchar(255)` | — | — |
| `utm_campaign` | `varchar(255)` | — | — |
| `utm_term` | `varchar(255)` | — | — |
| `utm_content` | `varchar(255)` | — | — |
| `referrer` | `text` | — | — |
| `landing_page` | `text` | — | — |
| `event_type` | `varchar(50)` | — | `'page_view'::character varying` |
| `created_at` | `timestamptz` | — | `now()` |

## `products`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('products_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `name` | `varchar(255)` | — | — |
| `description` | `text` | — | — |
| `price` | `numeric` | — | — |
| `cover_image_url` | `varchar(500)` | — | — |
| `created_at` | `timestamptz` | — | `now()` |

## `reports`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `uuid` | `uuid` | 🔑 PK | `gen_random_uuid()` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `title` | `text` | NOT NULL | — |
| `ai_summary` | `text` | — | — |
| `metrics_snapshot` | `jsonb` | — | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

## `sales`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('sales_id_seq'::regclass)` |
| `external_id` | `text` | — | — |
| `client_name` | `text` | — | — |
| `client_email` | `text` | — | — |
| `contract_value` | `numeric(10,2)` | — | `0` |
| `status` | `text` | — | — |
| `utm_source` | `text` | — | — |
| `utm_campaign` | `text` | — | — |
| `sale_date` | `date` | — | `CURRENT_DATE` |
| `created_at` | `timestamp` | — | `CURRENT_TIMESTAMP` |
| `utm_content` | `text` | — | — |
| `utm_term` | `text` | — | — |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |

### Índices

- `idx_sales_workspace`
- `sales_external_id_key`

## `settings`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `key` | `text` | 🔑 PK | — |
| `value` | `text` | — | — |

## `spy_creatives`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('spy_creatives_id_seq'::regclass)` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE) | — |
| `ad_url` | `text` | — | — |
| `ad_media_url` | `text` | — | — |
| `ad_copy` | `text` | — | — |
| `competitor_name` | `varchar(255)` | — | — |
| `created_at` | `timestamptz` | — | `now()` |

## `subscriptions`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `workspace_id` | `int` | 🔑 PK, 🔗 → `workspaces.id` (CASCADE) | — |
| `plan_name` | `varchar(50)` | — | `'free'::character varying` |
| `stripe_customer_id` | `varchar(100)` | — | — |
| `stripe_subscription_id` | `varchar(100)` | — | — |
| `status` | `varchar(20)` | — | `'active'::character varying` |
| `current_period_end` | `timestamptz` | — | — |

## `user_workspaces`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `user_id` | `int` | 🔗 → `users.id` (CASCADE), NOT NULL | — |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE), NOT NULL | — |
| `role` | `text` | NOT NULL | `'viewer'::text` |

### Índices

- `user_workspaces_user_id_workspace_id_key`

## `users`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('users_id_seq'::regclass)` |
| `username` | `text` | NOT NULL | — |
| `password_hash` | `text` | NOT NULL | — |
| `display_name` | `text` | — | — |
| `role` | `text` | NOT NULL | `'admin'::text` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `workspace_id` | `int` | 🔗 → `workspaces.id` (SET NULL) | — |

### Índices

- `idx_users_username`
- `users_username_key`

## `wa_settings`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `workspace_id` | `int` | 🔑 PK, 🔗 → `workspaces.id` (CASCADE) | — |
| `api_url` | `varchar(255)` | — | — |
| `api_token` | `varchar(255)` | — | — |
| `active` | `bool` | — | `false` |

## `webhook_events`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `bigint` | 🔑 PK | `nextval('webhook_events_id_seq'::regclass)` |
| `provider` | `varchar(50)` | NOT NULL | — |
| `external_id` | `varchar(255)` | NOT NULL | — |
| `payload` | `jsonb` | — | — |
| `processed_at` | `timestamptz` | — | `now()` |

### Índices

- `idx_webhook_events_processed`
- `webhook_events_provider_external_id_key`

## `workspace_billing`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `workspace_id` | `int` | 🔑 PK, 🔗 → `workspaces.id` (NO ACTION) | — |
| `plan_type` | `varchar(50)` | — | `'TRIAL'::character varying` |
| `credits_limit` | `numeric(10,2)` | — | `5.00` |
| `credits_used` | `numeric(10,2)` | — | `0.00` |

## `workspace_settings`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `workspace_id` | `int` | 🔗 → `workspaces.id` (CASCADE), NOT NULL | — |
| `key` | `text` | NOT NULL | — |
| `value` | `text` | — | — |

### Índices

- `workspace_settings_workspace_id_key_key`
- `workspace_settings_ws_key_unique`

## `workspaces`

### Colunas

| Coluna | Tipo | Constraints | Default |
|---|---|---|---|
| `id` | `int` | 🔑 PK | `nextval('workspaces_id_seq'::regclass)` |
| `name` | `text` | NOT NULL | — |
| `slug` | `text` | — | — |
| `logo_url` | `text` | — | — |
| `theme_color` | `text` | — | `'#00ADA7'::text` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `is_franchise` | `bool` | — | `false` |
| `franchise_name` | `varchar(255)` | — | — |
| `franchise_logo` | `varchar(500)` | — | — |
| `nexus_fee_percentage` | `numeric` | — | `5.0` |

### Índices

- `workspaces_slug_key`
