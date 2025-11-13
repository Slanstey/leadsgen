-- Allow admin users to insert new tenants
CREATE POLICY "Admins can insert tenants"
ON tenants
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = true
  )
);

-- Allow admin users to update tenants
CREATE POLICY "Admins can update tenants"
ON tenants
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = true
  )
);

-- Allow admin users to delete tenants
CREATE POLICY "Admins can delete tenants"
ON tenants
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = true
  )
);

