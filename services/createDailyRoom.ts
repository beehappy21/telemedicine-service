export interface DailyRoom {
  name: string;
  url: string;
}

export async function createDailyRoom(apiKey: string): Promise<DailyRoom> {
  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      privacy: 'private',
      properties: {
        enable_prejoin_ui: true,
        enable_knocking: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Daily.co room: ${response.statusText}`);
  }

  const data = (await response.json()) as { name: string; url: string };
  return { name: data.name, url: data.url };
}

export async function createMeetingToken(
  apiKey: string,
  roomName: string,
  userId: string,
  isOwner = false
): Promise<string> {
  const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_id: userId,
        ...(isOwner ? { is_owner: true } : {}),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create meeting token: ${response.statusText}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}
