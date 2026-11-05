-- ═══════════════════════════════════════════════════════════════════
-- DentalCare · seed.sql — demo dataset (optional; run AFTER migration.sql)
-- 10 patients, 12 appointments (incl. 5 for "today"), clinical records,
-- treatments, prescriptions, invoices, payments, notifications.
-- Dates are relative to 2026-09-09. Safe to re-run partially (uses plain
-- inserts; de-duplicate by truncating demo tables first if needed).
-- ═══════════════════════════════════════════════════════════════════

-- Patients (ids 1–9 active, 10 archived)
insert into patients (first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact_name, emergency_contact_phone, blood_type, allergies, medical_history, insurance_provider, insurance_number, status, created_by) values
  ('Wanjiru','Njoroge','1990-03-14','female','+254722100001','w.njoroge@example.com','12 Riverside Drive, Nairobi','Mary Njoroge','+254722111001','O+','Penicillin','Hypertension (controlled)','NHIF','NHIF-88213','active','reception@dentalcare.com'),
  ('David','Otieno','1985-07-22','male','+254722100002','d.otieno@example.com','45 Ngong Road, Nairobi','Faith Otieno','+254722111002','A+',null,'None',null,null,'active','reception@dentalcare.com'),
  ('Fatuma','Hassan','1998-11-05','female','+254722100003','f.hassan@example.com','8 Mombasa Road, Nairobi','Ali Hassan','+254722111003','B+','Latex','Asthma','Jubilee','JUB-44120','active','reception@dentalcare.com'),
  ('Samuel','Kiprop','1976-01-30','male','+254722100004','s.kiprop@example.com','21 Kiambu Road, Nairobi','Jane Kiprop','+254722111004','AB+',null,'Diabetes Type 2',null,null,'active','reception@dentalcare.com'),
  ('Linda','Achieng','2001-06-17','female','+254722100005','l.achieng@example.com','3 Westlands, Nairobi','Rose Achieng','+254722111005','O-',null,'None',null,null,'active','reception@dentalcare.com'),
  ('Joseph','Mbugua','1968-09-09','male','+254722100006','j.mbugua@example.com','77 Langata Road, Nairobi','Anne Mbugua','+254722111006','A-','Sulfa drugs','Heart murmur','NHIF','NHIF-90177','active','reception@dentalcare.com'),
  ('Nancy','Wafula','1994-12-01','female','+254722100007','n.wafula@example.com','19 Thika Road, Nairobi','Brian Wafula','+254722111007','B-',null,'None',null,null,'active','reception@dentalcare.com'),
  ('Brian','Kariuki','2015-04-20','male','+254722100008',null,'54 Karen Road, Nairobi','Peter Kariuki (father)','+254722111008','O+',null,'None',null,null,'active','reception@dentalcare.com'),
  ('Mercy','Owino','1982-02-11','female','+254722100009','m.owino@example.com','2 Lavington, Nairobi','Tom Owino','+254722111009','AB-','Aspirin','Pregnant - 2nd trimester','APA','APA-77310','active','reception@dentalcare.com'),
  ('George','Mwenda','1970-08-25','male','+254722100010','g.mwenda@example.com','90 Jogoo Road, Nairobi','Lucy Mwenda','+254722111010','A+',null,'None',null,null,'archived','admin@dentalcare.com');

-- Appointments (dentist ids: 2 = Dr. Mwangi, 3 = Dr. Odhiambo)
insert into appointments (patient_id, dentist_id, appointment_date, start_time, end_time, reason, status, notes, created_by) values
  (1, 2, '2026-09-09', '09:00', '09:30', 'Routine checkup & cleaning', 'completed', 'Routine checkup', 'reception@dentalcare.com'),
  (2, 2, '2026-09-09', '09:45', '10:30', 'Root canal - tooth 36', 'in_progress', null, 'reception@dentalcare.com'),
  (3, 3, '2026-09-09', '09:30', '10:00', 'Braces adjustment', 'scheduled', null, 'reception@dentalcare.com'),
  (5, 3, '2026-09-09', '10:15', '11:00', 'Tooth extraction - wisdom tooth 48', 'scheduled', null, 'reception@dentalcare.com'),
  (4, 2, '2026-09-09', '11:00', '12:00', 'Crown fitting - tooth 26', 'scheduled', null, 'reception@dentalcare.com'),
  (6, 2, '2026-09-08', '09:00', '10:00', 'Filling - tooth 14', 'completed', 'Completed without complications', 'reception@dentalcare.com'),
  (7, 3, '2026-09-08', '10:00', '11:00', 'Teeth whitening', 'no_show', 'Patient did not show up', 'reception@dentalcare.com'),
  (9, 2, '2026-09-07', '09:00', '09:45', 'Checkup - pregnancy-safe plan', 'completed', null, 'reception@dentalcare.com'),
  (8, 2, '2026-09-10', '09:00', '10:00', 'Pediatric checkup', 'scheduled', null, 'reception@dentalcare.com'),
  (1, 3, '2026-09-10', '10:30', '11:30', 'Root canal follow-up', 'scheduled', null, 'reception@dentalcare.com'),
  (3, 2, '2026-09-11', '11:00', '12:00', 'Implant consultation', 'scheduled', null, 'reception@dentalcare.com'),
  (4, 3, '2026-09-12', '09:30', '10:30', 'Denture fitting', 'scheduled', null, 'reception@dentalcare.com');

-- Clinical
insert into dental_records (patient_id, dentist_id, record_date, tooth_number, diagnosis, treatment_plan, notes, status, created_by) values
  (2, 2, '2026-09-02', '36', 'Chronic apical periodontitis, tooth 36', 'Root canal treatment + porcelain crown', 'Single-visit RCT completed. Post-op instructions given.', 'closed', 'dentist@dentalcare.com'),
  (1, 2, '2026-09-09', null, 'Generalized plaque & early gingivitis', 'Scaling & polishing', 'Good home care; recommend 6-month recall.', 'closed', 'dentist@dentalcare.com'),
  (3, 3, '2026-09-05', null, 'Class II malocclusion', 'Fixed orthodontic appliance, 18 months', 'Monthly review scheduled.', 'in_progress', 'dentist2@dentalcare.com'),
  (4, 2, '2026-09-06', '26', 'Deep caries approaching pulp, tooth 26', 'Porcelain-fused-metal crown', 'Crown prep done; temporary placed.', 'in_progress', 'dentist@dentalcare.com'),
  (5, 3, '2026-09-08', '48', 'Impacted mesioangular wisdom tooth 48', 'Surgical extraction', 'Surgical extraction under local anaesthesia planned.', 'open', 'dentist2@dentalcare.com');

insert into treatments (patient_id, dentist_id, appointment_id, procedure_name, tooth_number, treatment_date, cost, status, notes, created_by) values
  (1, 2, 1, 'Scaling & Polishing', null, '2026-09-09', 3500, 'completed', 'Full-mouth scale and polish', 'dentist@dentalcare.com'),
  (2, 2, null, 'Root Canal Treatment', '36', '2026-09-02', 18000, 'completed', 'Single visit RCT', 'dentist@dentalcare.com'),
  (4, 2, null, 'Porcelain Crown', '26', '2026-09-06', 45000, 'in_progress', 'Crown ordered from lab', 'dentist@dentalcare.com'),
  (3, 3, null, 'Orthodontic Braces', null, '2026-09-05', 150000, 'in_progress', 'Braces fitted upper + lower', 'dentist2@dentalcare.com'),
  (5, 3, null, 'Surgical Extraction', '48', '2026-09-09', 12000, 'planned', null, 'dentist2@dentalcare.com'),
  (6, 2, 6, 'Composite Filling', '14', '2026-09-08', 4500, 'completed', null, 'dentist@dentalcare.com');

insert into prescriptions (patient_id, dentist_id, medication, dosage, frequency, duration, instructions, prescribed_date, created_by) values
  (2, 2, 'Amoxicillin', '500mg', '3x daily', '5 days', 'Take after meals', '2026-09-02', 'dentist@dentalcare.com'),
  (2, 2, 'Ibuprofen', '400mg', '2x daily as needed', '3 days', 'Take with food for pain', '2026-09-02', 'dentist@dentalcare.com'),
  (5, 3, 'Paracetamol', '500mg', '2x daily as needed', '3 days', 'Post-extraction pain management', '2026-09-08', 'dentist2@dentalcare.com'),
  (1, 2, 'Chlorhexidine mouthwash', '0.2%', '2x daily rinse', '7 days', 'Do not swallow; avoid eating 30 min after', '2026-09-09', 'dentist@dentalcare.com');

-- Billing (KES)
insert into invoices (invoice_number, patient_id, treatment_id, total_amount, amount_paid, balance, status, issue_date, due_date, notes, created_by) values
  ('INV-2026-000101', 1, 1, 3500, 3500, 0, 'paid', '2026-09-09', '2026-09-16', 'Scale & polish', 'reception@dentalcare.com'),
  ('INV-2026-000102', 2, 2, 18000, 10000, 8000, 'partially_paid', '2026-09-02', '2026-09-16', 'RCT + crown balance', 'reception@dentalcare.com'),
  ('INV-2026-000103', 4, 3, 45000, 0, 45000, 'unpaid', '2026-09-06', '2026-09-20', 'Crown - lab work pending', 'reception@dentalcare.com'),
  ('INV-2026-000104', 3, 4, 150000, 60000, 90000, 'partially_paid', '2026-09-05', '2026-12-05', 'Braces phased payments', 'reception@dentalcare.com'),
  ('INV-2026-000105', 6, 6, 4500, 4500, 0, 'paid', '2026-09-08', '2026-09-15', null, 'reception@dentalcare.com');

insert into payments (invoice_id, patient_id, amount, payment_method, payment_date, reference_number, notes, received_by) values
  (1, 1, 3500, 'mpesa', '2026-09-09', 'MPESA-QHX7K2', null, 'reception@dentalcare.com'),
  (2, 2, 10000, 'mpesa', '2026-09-02', 'MPESA-PLM91A', 'Deposit for RCT', 'reception@dentalcare.com'),
  (4, 3, 30000, 'bank', '2026-09-05', 'TRF-2026-7781', 'Braces installment 1', 'accounts@dentalcare.com'),
  (4, 3, 30000, 'mpesa', '2026-09-09', 'MPESA-ZT44QW', 'Braces installment 2', 'reception@dentalcare.com'),
  (5, 6, 4500, 'cash', '2026-09-08', null, null, 'reception@dentalcare.com');

insert into notifications (title, message, type, related_id, is_read) values
  ('Appointment today: Wanjiru Njoroge', 'Wanjiru Njoroge has a routine checkup at 09:00 with Dr. James Mwangi.', 'appointment', 'appointment:1', false),
  ('Unpaid invoice: INV-2026-000103', 'Invoice INV-2026-000103 (45000.00) for Samuel Kiprop is unpaid.', 'billing', 'invoice:3', false),
  ('New patient registered', 'Fatuma Hassan was registered by Grace Wanjiku.', 'patient', 'patient:3', true),
  ('Payment received', 'Payment of 30000.00 recorded for invoice INV-2026-000104.', 'payment', 'invoice:4', false);
