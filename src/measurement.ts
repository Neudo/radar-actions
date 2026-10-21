// Single accepted measurement view. Revisions are evidence, NOT replacement prices.
export const measurementPolicy = "frozen-first-v1";
export const unresolvedSQL = (alias = "s") => `EXISTS (
 SELECT 1 FROM data_conflicts dc
 LEFT JOIN price_observations po ON po.signal_id=dc.signal_id AND po.session=dc.session
 LEFT JOIN price_revisions pr ON pr.observation_id=po.id AND pr.new_hash=dc.new_hash
 WHERE dc.signal_id=${alias}.id AND (pr.id IS NULL OR pr.decision='exclude')
)`;
export const eligibleSQL = `COALESCE(p.status,'pending') NOT IN ('missing','quarantined','pending_data') AND s.data_status!='missing' AND s.signal_price IS NOT NULL AND COALESCE(s.payload->>'assessment_status','assessed')!='unknown' AND NOT (${unresolvedSQL()})`;
