-- CreateTable
CREATE TABLE `customers` (
    `customer_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `billing_address` TEXT NULL,
    `tax_registration_number` VARCHAR(50) NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customers_email_idx`(`email`),
    INDEX `customers_company_name_idx`(`company_name`),
    PRIMARY KEY (`customer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'STAFF', 'CUSTOMER') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_customer_id_idx`(`customer_id`),
    INDEX `users_role_is_active_idx`(`role`, `is_active`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_resets` (
    `reset_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_resets_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`reset_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `product_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `product_type` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `sales_price` DECIMAL(12, 2) NOT NULL,
    `cost_price` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `products_name_idx`(`name`),
    INDEX `products_product_type_status_idx`(`product_type`, `status`),
    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `variant_id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `attribute_name` VARCHAR(100) NOT NULL,
    `attribute_value` VARCHAR(100) NOT NULL,
    `price_delta` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_variants_product_id_is_active_idx`(`product_id`, `is_active`),
    UNIQUE INDEX `product_variants_product_id_attribute_name_attribute_value_key`(`product_id`, `attribute_name`, `attribute_value`),
    PRIMARY KEY (`variant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans` (
    `plan_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `pricing_mode` ENUM('FIXED', 'ITEMIZED') NOT NULL DEFAULT 'FIXED',
    `plan_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `billing_cycle` ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY') NOT NULL,
    `minimum_quantity` INTEGER NOT NULL DEFAULT 1,
    `available_from` DATE NOT NULL,
    `available_until` DATE NULL,
    `auto_close` BOOLEAN NOT NULL DEFAULT false,
    `allow_early_close` BOOLEAN NOT NULL DEFAULT true,
    `allow_pause` BOOLEAN NOT NULL DEFAULT true,
    `allow_renewal` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `plans_status_billing_cycle_idx`(`status`, `billing_cycle`),
    INDEX `plans_available_from_available_until_idx`(`available_from`, `available_until`),
    PRIMARY KEY (`plan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_products` (
    `plan_product_id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price_override` DECIMAL(12, 2) NULL,

    INDEX `plan_products_product_id_idx`(`product_id`),
    UNIQUE INDEX `plan_products_plan_id_product_id_key`(`plan_id`, `product_id`),
    PRIMARY KEY (`plan_product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_rules` (
    `tax_rule_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `tax_rate` DECIMAL(7, 4) NOT NULL,
    `description` TEXT NULL,
    `effective_from` DATE NOT NULL,
    `effective_until` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tax_rules_is_active_effective_from_effective_until_idx`(`is_active`, `effective_from`, `effective_until`),
    PRIMARY KEY (`tax_rule_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_tax_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `tax_rule_id` INTEGER NOT NULL,

    INDEX `product_tax_rules_tax_rule_id_idx`(`tax_rule_id`),
    UNIQUE INDEX `product_tax_rules_product_id_tax_rule_id_key`(`product_id`, `tax_rule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discounts` (
    `discount_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `discount_type` ENUM('FIXED', 'PERCENTAGE') NOT NULL,
    `discount_value` DECIMAL(12, 2) NOT NULL,
    `minimum_purchase` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `minimum_quantity` INTEGER NOT NULL DEFAULT 0,
    `usage_limit` INTEGER NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NULL,
    `scope` ENUM('PRODUCT', 'SUBSCRIPTION') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `discounts_is_active_starts_at_ends_at_idx`(`is_active`, `starts_at`, `ends_at`),
    INDEX `discounts_scope_discount_type_idx`(`scope`, `discount_type`),
    PRIMARY KEY (`discount_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discount_products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `discount_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,

    INDEX `discount_products_product_id_idx`(`product_id`),
    UNIQUE INDEX `discount_products_discount_id_product_id_key`(`discount_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_discounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_id` INTEGER NOT NULL,
    `discount_id` INTEGER NOT NULL,
    `assigned_by` INTEGER NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `subscription_discounts_discount_id_is_active_idx`(`discount_id`, `is_active`),
    UNIQUE INDEX `subscription_discounts_subscription_id_discount_id_key`(`subscription_id`, `discount_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discount_redemptions` (
    `redemption_id` INTEGER NOT NULL AUTO_INCREMENT,
    `discount_id` INTEGER NOT NULL,
    `subscription_id` INTEGER NULL,
    `invoice_id` INTEGER NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL,
    `redeemed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `discount_redemptions_discount_id_redeemed_at_idx`(`discount_id`, `redeemed_at`),
    INDEX `discount_redemptions_subscription_id_idx`(`subscription_id`),
    INDEX `discount_redemptions_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`redemption_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_templates` (
    `template_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `plan_id` INTEGER NOT NULL,
    `validity_days` INTEGER NOT NULL,
    `payment_terms` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quotation_templates_plan_id_is_active_idx`(`plan_id`, `is_active`),
    PRIMARY KEY (`template_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_template_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `variant_id` INTEGER NULL,
    `quantity` INTEGER NOT NULL,

    INDEX `quotation_template_lines_template_id_idx`(`template_id`),
    INDEX `quotation_template_lines_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotations` (
    `quotation_id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotation_number` VARCHAR(50) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `template_id` INTEGER NULL,
    `created_by` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `quotation_date` DATE NOT NULL,
    `expiry_date` DATE NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `discount_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quotations_quotation_number_key`(`quotation_number`),
    INDEX `quotations_customer_id_status_idx`(`customer_id`, `status`),
    INDEX `quotations_created_by_idx`(`created_by`),
    INDEX `quotations_status_expiry_date_idx`(`status`, `expiry_date`),
    PRIMARY KEY (`quotation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_lines` (
    `line_id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotation_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `variant_id` INTEGER NULL,
    `description_snapshot` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `line_total` DECIMAL(12, 2) NOT NULL,

    INDEX `quotation_lines_quotation_id_idx`(`quotation_id`),
    INDEX `quotation_lines_product_id_idx`(`product_id`),
    PRIMARY KEY (`line_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `subscription_id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_number` VARCHAR(50) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `plan_id` INTEGER NOT NULL,
    `quotation_id` INTEGER NULL,
    `created_by` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `start_date` DATE NOT NULL,
    `expiry_date` DATE NULL,
    `next_billing_date` DATE NULL,
    `last_billing_date` DATE NULL,
    `billing_cycle` ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY') NOT NULL,
    `payment_terms_days` INTEGER NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscriptions_subscription_number_key`(`subscription_number`),
    UNIQUE INDEX `subscriptions_quotation_id_key`(`quotation_id`),
    INDEX `subscriptions_customer_id_status_idx`(`customer_id`, `status`),
    INDEX `subscriptions_plan_id_idx`(`plan_id`),
    INDEX `subscriptions_status_next_billing_date_idx`(`status`, `next_billing_date`),
    INDEX `subscriptions_created_by_idx`(`created_by`),
    PRIMARY KEY (`subscription_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_lines` (
    `line_id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `variant_id` INTEGER NULL,
    `description_snapshot` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subscription_lines_subscription_id_idx`(`subscription_id`),
    INDEX `subscription_lines_product_id_idx`(`product_id`),
    PRIMARY KEY (`line_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_history` (
    `history_id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_id` INTEGER NOT NULL,
    `previous_status` ENUM('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED') NULL,
    `new_status` ENUM('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED') NOT NULL,
    `changed_by` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subscription_history_subscription_id_changed_at_idx`(`subscription_id`, `changed_at`),
    INDEX `subscription_history_changed_by_idx`(`changed_by`),
    PRIMARY KEY (`history_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `invoice_id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_number` VARCHAR(50) NOT NULL,
    `subscription_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `billing_period_start` DATE NOT NULL,
    `billing_period_end` DATE NOT NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `discount_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoice_number_key`(`invoice_number`),
    INDEX `invoices_customer_id_status_idx`(`customer_id`, `status`),
    INDEX `invoices_status_due_date_idx`(`status`, `due_date`),
    INDEX `invoices_invoice_date_idx`(`invoice_date`),
    UNIQUE INDEX `invoices_subscription_id_billing_period_start_billing_period_key`(`subscription_id`, `billing_period_start`, `billing_period_end`),
    PRIMARY KEY (`invoice_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_lines` (
    `invoice_line_id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `description_snapshot` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxable_amount` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `line_total` DECIMAL(12, 2) NOT NULL,

    INDEX `invoice_lines_invoice_id_idx`(`invoice_id`),
    INDEX `invoice_lines_product_id_idx`(`product_id`),
    PRIMARY KEY (`invoice_line_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_line_taxes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_line_id` INTEGER NOT NULL,
    `tax_rule_id` INTEGER NULL,
    `tax_name_snapshot` VARCHAR(100) NOT NULL,
    `tax_rate_snapshot` DECIMAL(7, 4) NOT NULL,
    `tax_amount` DECIMAL(12, 2) NOT NULL,

    INDEX `invoice_line_taxes_invoice_line_id_idx`(`invoice_line_id`),
    INDEX `invoice_line_taxes_tax_rule_id_idx`(`tax_rule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `payment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_reference` VARCHAR(100) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `payment_method` ENUM('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'GATEWAY', 'OTHER') NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
    `provider` ENUM('RAZORPAY', 'STRIPE', 'PAYPAL', 'OTHER') NULL,
    `provider_order_id` VARCHAR(191) NULL,
    `provider_payment_id` VARCHAR(191) NULL,
    `payment_date` DATETIME(3) NULL,
    `transaction_reference` VARCHAR(150) NULL,
    `note` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_payment_reference_key`(`payment_reference`),
    UNIQUE INDEX `payments_provider_order_id_key`(`provider_order_id`),
    UNIQUE INDEX `payments_provider_payment_id_key`(`provider_payment_id`),
    INDEX `payments_customer_id_status_idx`(`customer_id`, `status`),
    INDEX `payments_payment_date_idx`(`payment_date`),
    INDEX `payments_provider_status_idx`(`provider`, `status`),
    PRIMARY KEY (`payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `allocation_id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_id` INTEGER NOT NULL,
    `invoice_id` INTEGER NOT NULL,
    `allocated_amount` DECIMAL(12, 2) NOT NULL,
    `allocated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_allocations_invoice_id_idx`(`invoice_id`),
    UNIQUE INDEX `payment_allocations_payment_id_invoice_id_key`(`payment_id`, `invoice_id`),
    PRIMARY KEY (`allocation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_gateway_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_id` INTEGER NULL,
    `provider` ENUM('RAZORPAY', 'STRIPE', 'PAYPAL', 'OTHER') NOT NULL,
    `provider_event_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `status` ENUM('RECEIVED', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
    `payload` JSON NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,

    UNIQUE INDEX `payment_gateway_events_provider_event_id_key`(`provider_event_id`),
    INDEX `payment_gateway_events_payment_id_idx`(`payment_id`),
    INDEX `payment_gateway_events_provider_status_idx`(`provider`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_executions` (
    `execution_id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_id` INTEGER NOT NULL,
    `billing_period_start` DATE NOT NULL,
    `billing_period_end` DATE NOT NULL,
    `invoice_id` INTEGER NULL,
    `status` ENUM('PROCESSING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PROCESSING',
    `error_message` TEXT NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 1,
    `executed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `billing_executions_invoice_id_key`(`invoice_id`),
    INDEX `billing_executions_status_executed_at_idx`(`status`, `executed_at`),
    UNIQUE INDEX `billing_executions_subscription_id_billing_period_start_bill_key`(`subscription_id`, `billing_period_start`, `billing_period_end`),
    PRIMARY KEY (`execution_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `log_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` VARCHAR(100) NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_products` ADD CONSTRAINT `plan_products_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`plan_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_products` ADD CONSTRAINT `plan_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_tax_rules` ADD CONSTRAINT `product_tax_rules_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_tax_rules` ADD CONSTRAINT `product_tax_rules_tax_rule_id_fkey` FOREIGN KEY (`tax_rule_id`) REFERENCES `tax_rules`(`tax_rule_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discount_products` ADD CONSTRAINT `discount_products_discount_id_fkey` FOREIGN KEY (`discount_id`) REFERENCES `discounts`(`discount_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discount_products` ADD CONSTRAINT `discount_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_discounts` ADD CONSTRAINT `subscription_discounts_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`subscription_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_discounts` ADD CONSTRAINT `subscription_discounts_discount_id_fkey` FOREIGN KEY (`discount_id`) REFERENCES `discounts`(`discount_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_discounts` ADD CONSTRAINT `subscription_discounts_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discount_redemptions` ADD CONSTRAINT `discount_redemptions_discount_id_fkey` FOREIGN KEY (`discount_id`) REFERENCES `discounts`(`discount_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discount_redemptions` ADD CONSTRAINT `discount_redemptions_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`subscription_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discount_redemptions` ADD CONSTRAINT `discount_redemptions_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_templates` ADD CONSTRAINT `quotation_templates_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`plan_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_template_lines` ADD CONSTRAINT `quotation_template_lines_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `quotation_templates`(`template_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_template_lines` ADD CONSTRAINT `quotation_template_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_template_lines` ADD CONSTRAINT `quotation_template_lines_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`variant_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `quotation_templates`(`template_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_lines` ADD CONSTRAINT `quotation_lines_quotation_id_fkey` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`quotation_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_lines` ADD CONSTRAINT `quotation_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_lines` ADD CONSTRAINT `quotation_lines_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`variant_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`plan_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_quotation_id_fkey` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`quotation_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_lines` ADD CONSTRAINT `subscription_lines_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`subscription_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_lines` ADD CONSTRAINT `subscription_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_lines` ADD CONSTRAINT `subscription_lines_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`variant_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_history` ADD CONSTRAINT `subscription_history_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`subscription_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_history` ADD CONSTRAINT `subscription_history_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`subscription_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_line_taxes` ADD CONSTRAINT `invoice_line_taxes_invoice_line_id_fkey` FOREIGN KEY (`invoice_line_id`) REFERENCES `invoice_lines`(`invoice_line_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_line_taxes` ADD CONSTRAINT `invoice_line_taxes_tax_rule_id_fkey` FOREIGN KEY (`tax_rule_id`) REFERENCES `tax_rules`(`tax_rule_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`payment_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_gateway_events` ADD CONSTRAINT `payment_gateway_events_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`payment_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_executions` ADD CONSTRAINT `billing_executions_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`subscription_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_executions` ADD CONSTRAINT `billing_executions_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
