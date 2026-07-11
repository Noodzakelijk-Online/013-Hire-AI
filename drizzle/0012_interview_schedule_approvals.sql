ALTER TABLE `application_approvals` MODIFY COLUMN `approval_type` enum('application_submission','follow_up_send','offer_attribution','interview_schedule','profile_claim','billing_action') NOT NULL;
