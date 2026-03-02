
-- Create test auth users (password: Test@12345)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'carlos.eletricista@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Carlos Eletricista","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'ana.limpeza@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Ana Limpeza Profissional","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'roberto.encanador@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Roberto Encanador","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'mariana.designer@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Mariana Designer","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'joao.pintor@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"João Pintor","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'fernanda.fotografa@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Fernanda Fotógrafa","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'pedro.jardineiro@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Pedro Jardineiro","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'luciana.dev@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Luciana Dev Web","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'marcos.mecanico@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Marcos Mecânico","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'camila.beleza@test.com', crypt('Test@12345', gen_salt('bf')), now(), '{"display_name":"Camila Beleza","user_type":"provider"}'::jsonb, 'authenticated', 'authenticated', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Create identities for test users
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '{"sub":"00000000-0000-0000-0000-000000000001","email":"carlos.eletricista@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000001', now(), now(), now()),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '{"sub":"00000000-0000-0000-0000-000000000002","email":"ana.limpeza@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000002', now(), now(), now()),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '{"sub":"00000000-0000-0000-0000-000000000003","email":"roberto.encanador@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000003', now(), now(), now()),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', '{"sub":"00000000-0000-0000-0000-000000000004","email":"mariana.designer@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000004', now(), now(), now()),
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', '{"sub":"00000000-0000-0000-0000-000000000005","email":"joao.pintor@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000005', now(), now(), now()),
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', '{"sub":"00000000-0000-0000-0000-000000000006","email":"fernanda.fotografa@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000006', now(), now(), now()),
('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000007', '{"sub":"00000000-0000-0000-0000-000000000007","email":"pedro.jardineiro@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000007', now(), now(), now()),
('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000008', '{"sub":"00000000-0000-0000-0000-000000000008","email":"luciana.dev@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000008', now(), now(), now()),
('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000009', '{"sub":"00000000-0000-0000-0000-000000000009","email":"marcos.mecanico@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000009', now(), now(), now()),
('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000010', '{"sub":"00000000-0000-0000-0000-000000000010","email":"camila.beleza@test.com"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000010', now(), now(), now())
ON CONFLICT DO NOTHING;
