module.exports = async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Geen autorisatiecode ontvangen.');
  }

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  const CLIENT_ROLE_ID = process.env.DISCORD_CLIENT_ROLE_ID;
  const OLD_ROLE_ID = '1343942896562339860';
  const REDIRECT_URI = 'https://community.lifestyleperformance.nl/api/discord-callback';
  const RETURN_URL = 'https://lifestyleperformance.nl/client-onboarding';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).send('Autorisatie mislukt. Probeer opnieuw.');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
    const userData = await userResponse.json();
    const userId = userData.id;

    const joinResponse = await fetch(
      'https://discord.com/api/guilds/' + GUILD_ID + '/members/' + userId,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bot ' + BOT_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: tokenData.access_token,
          roles: [CLIENT_ROLE_ID],
        }),
      }
    );

    if (!joinResponse.ok && joinResponse.status !== 204) {
      const errText = await joinResponse.text();
      return res.status(500).send('Toevoegen aan server mislukt: ' + errText);
    }

    const roleResponse = await fetch(
      'https://discord.com/api/guilds/' + GUILD_ID + '/members/' + userId + '/roles/' + CLIENT_ROLE_ID,
      {
        method: 'PUT',
        headers: { Authorization: 'Bot ' + BOT_TOKEN },
      }
    );

    if (!roleResponse.ok) {
      const errText = await roleResponse.text();
      return res.status(500).send('Rol toewijzen mislukt: ' + errText);
    }

    // Korte vertraging: Discord's eigen "geef nieuwe leden automatisch een rol"
    // (via onboarding/MEE6) kent een kleine vertraging na het accepteren van de
    // serverregels. We wachten hier even zodat die toewijzing eerst kan gebeuren,
    // voordat wij de oude rol weer verwijderen.
    await sleep(4000);

    // Verwijder de oude rol (bv. "Lifestyle Performance Member"), zodat alleen
    // de Client-rol overblijft. Fouten worden bewust genegeerd: als de gebruiker
    // de oude rol toch niet had, mag dat de flow niet blokkeren.
    try {
      await fetch(
        'https://discord.com/api/guilds/' + GUILD_ID + '/members/' + userId + '/roles/' + OLD_ROLE_ID,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bot ' + BOT_TOKEN },
        }
      );
    } catch (e) {
      // Bewust genegeerd, zie toelichting hierboven.
    }

    return res.status(200).send(
      '<html><head><meta http-equiv="refresh" content="5;url=' + RETURN_URL + '"></head>' +
      '<body style="font-family: sans-serif; text-align: center; padding: 60px;">' +
      '<h1>Welkom bij de exclusieve community!</h1>' +
      '<p>Je account is succesvol gekoppeld en geupgraded.</p>' +
      '<p style="color:#888; font-size:14px;">Je wordt over 5 seconden teruggestuurd...</p>' +
      '</body></html>'
    );
  } catch (err) {
    return res.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
  }
};
