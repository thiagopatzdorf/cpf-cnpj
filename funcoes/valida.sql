CREATE OR REPLACE FUNCTION valida_cpf(cpf text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text := regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g'); s int; r int;
BEGIN
  -- Só dígito e máscara: '529.982.247-25x' é erro, não CPF.
  IF coalesce(cpf, '') ~ '[^0-9.[:space:]-]' THEN RETURN false; END IF;
  IF length(d) <> 11 OR d = repeat(left(d, 1), 11) THEN RETURN false; END IF;
  FOR t IN 9..10 LOOP
    s := 0;
    FOR i IN 1..t LOOP s := s + substr(d, i, 1)::int * (t + 2 - i); END LOOP;
    r := s % 11;
    IF (CASE WHEN r < 2 THEN 0 ELSE 11 - r END) <> substr(d, t + 1, 1)::int THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION valida_cnpj(cnpj text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE c text := regexp_replace(coalesce(cnpj, ''), '[./[:space:]-]', '', 'g'); s int; r int;
BEGIN
  -- Confere antes de pôr em maiúsculas: o upper() do banco depende do locale.
  IF c !~ '^[0-9A-Za-z]{12}[0-9]{2}$' THEN RETURN false; END IF;
  c := upper(c);
  IF c = repeat(left(c, 1), 14) THEN RETURN false; END IF;
  FOR t IN 12..13 LOOP
    s := 0;
    FOR i IN 1..t LOOP s := s + (ascii(substr(c, i, 1)) - 48) * (2 + (t - i) % 8); END LOOP;
    r := s % 11;
    IF (CASE WHEN r < 2 THEN 0 ELSE 11 - r END) <> substr(c, t + 1, 1)::int THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;
-- SELECT valida_cpf('529.982.247-25'), valida_cnpj('12.ABC.345/01DE-35');  -- true, true
