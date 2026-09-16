/** LinkedIn integration — OAuth flow + company research + job enrichment. */

export type LinkedInConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type LinkedInCompany = {
  name: string;
  description: string;
  industry: string;
  staffCount: number;
  website: string;
  linkedinUrl: string;
  headquarter: string;
};

export type LinkedInProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileUrl: string;
};

/** Generate LinkedIn OAuth authorization URL. */
export function getAuthUrl(config: LinkedInConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: 'openid profile email w_member_social',
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

/** Exchange authorization code for access token. */
export async function getAccessToken(config: LinkedInConfig, code: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Get user profile using OpenID Connect. */
export async function getProfile(accessToken: string): Promise<LinkedInProfile | null> {
  try {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      id: data.sub,
      firstName: data.given_name,
      lastName: data.family_name,
      email: data.email || '',
      profileUrl: `https://linkedin.com/in/${data.sub}`,
    };
  } catch {
    return null;
  }
}

/** Get company data from LinkedIn. Requires r_organization_social scope. */
export async function getCompany(accessToken: string, companyId: string): Promise<LinkedInCompany | null> {
  try {
    const res = await fetch(`https://api.linkedin.com/v2/organizations/${companyId}?projection=(id,name,description,industryV2,staffCountRange,websiteUrl,headquarter,vanityName)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      name: data.name?.localized?.en_US || data.name || '',
      description: data.description?.localized?.en_US || '',
      industry: data.industryV2?.name?.localized?.en_US || '',
      staffCount: data.staffCountRange?.start || 0,
      website: data.websiteUrl || '',
      linkedinUrl: `https://linkedin.com/company/${data.vanityName || companyId}`,
      headquarter: data.headquarter?.city || '',
    };
  } catch {
    return null;
  }
}

/** Search for company by name. Returns company ID. */
export async function searchCompany(accessToken: string, companyName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    // Find company by name in results
    for (const org of data.elements || []) {
      if (org.organizationalTarget?.name?.toLowerCase().includes(companyName.toLowerCase())) {
        return org.organizationalTarget.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Store LinkedIn token in D1. */
export async function storeToken(db: D1Database, profile: LinkedInProfile, accessToken: string, expiresIn: number): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  await db.prepare(
    `INSERT INTO linkedin_tokens (user_id, access_token, expires_at, profile_json, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET access_token=excluded.access_token, expires_at=excluded.expires_at, profile_json=excluded.profile_json`,
  )
    .bind(profile.id, accessToken, expiresAt, JSON.stringify(profile), new Date().toISOString())
    .run();
}

/** Get stored LinkedIn token. */
export async function getToken(db: D1Database): Promise<{ access_token: string; expires_at: string } | null> {
  return db.prepare('SELECT access_token, expires_at FROM linkedin_tokens ORDER BY created_at DESC LIMIT 1').first<{ access_token: string; expires_at: string }>();
}
