ALTER TABLE `autonomous_run_states`
  MODIFY COLUMN `last_status` enum('running','completed','failed','skipped');
--> statement-breakpoint
ALTER TABLE `autonomous_run_states`
  ADD `last_outcome_detail` text;
