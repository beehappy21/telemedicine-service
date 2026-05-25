export interface Patient {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Practitioner {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Encounter {
  id: string;
  patientId: string;
  [key: string]: unknown;
}

export class EmrClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiToken: string
  ) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      throw new Error(`EMR API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getPatient(patientId: string): Promise<Patient> {
    return this.request<Patient>(`/patients/${patientId}`);
  }

  async listPractitioners(clinicId: string): Promise<Practitioner[]> {
    return this.request<Practitioner[]>(`/clinics/${clinicId}/practitioners`);
  }

  async createEncounter(
    patientId: string,
    practitionerId: string,
    data: Record<string, unknown>
  ): Promise<Encounter> {
    return this.request<Encounter>('/encounters', {
      method: 'POST',
      body: JSON.stringify({ patientId, practitionerId, ...data }),
    });
  }
}
