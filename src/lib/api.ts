
const API_BASE = '/api'

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company: string | null;
  type: 'INDIVIDUAL' | 'HOSPITAL' | 'PHARMACY' | 'COMPANY';
  creditLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchClients(search = '', type = 'all'): Promise<Client[]> {
  try {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (type && type !== 'all') params.append('type', type)

    const response = await fetch(`${API_BASE}/clients?${params.toString()}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch clients: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching clients:', error)
    throw error
  }
}

export async function fetchClient(id: string): Promise<Client> {
  try {
    const response = await fetch(`${API_BASE}/clients/${id}`)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Client not found')
      }
      throw new Error(`Failed to fetch client: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching client:', error)
    throw error
  }
}

export async function createClient(clientData: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  type?: 'INDIVIDUAL' | 'HOSPITAL' | 'PHARMACY' | 'COMPANY';
  creditLimit?: number;
}): Promise<Client> {
  try {
    const response = await fetch(`${API_BASE}/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to create client: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating client:', error)
    throw error
  }
}

export async function updateClient(id: string, clientData: {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  type?: 'INDIVIDUAL' | 'HOSPITAL' | 'PHARMACY' | 'COMPANY';
  creditLimit?: number;
}): Promise<Client> {
  try {
    const response = await fetch(`${API_BASE}/clients/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to update client: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating client:', error)
    throw error
  }
}

export async function deleteClient(id: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/clients/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to delete client: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error deleting client:', error)
    throw error
  }
}

export async function searchClients(query: string): Promise<Client[]> {
  try {
    const response = await fetch(`${API_BASE}/clients?search=${encodeURIComponent(query)}&limit=10`)

    if (!response.ok) {
      throw new Error(`Failed to search clients: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error searching clients:', error)
    throw error
  }
}

export interface Manufacturer {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  motherCompany: string | null;
  address: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchManufacturers(search = ''): Promise<Manufacturer[]> {
  try {
    const params = new URLSearchParams()
    if (search) params.append('search', search)

    const response = await fetch(`${API_BASE}/manufacturers?${params.toString()}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch manufacturers: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching manufacturers:', error)
    throw error
  }
}

export async function fetchManufacturer(id: string): Promise<Manufacturer> {
  try {
    const response = await fetch(`${API_BASE}/manufacturers/${id}`)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Manufacturer not found')
      }
      throw new Error(`Failed to fetch manufacturer: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching manufacturer:', error)
    throw error
  }
}

export async function createManufacturer(manufacturerData: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  motherCompany?: string;
  address?: string;
  location?: string;
}): Promise<Manufacturer> {
  try {
    const response = await fetch(`${API_BASE}/manufacturers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturerData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to create manufacturer: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating manufacturer:', error)
    throw error
  }
}

export async function updateManufacturer(id: string, manufacturerData: {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  motherCompany?: string;
  address?: string;
  location?: string;
}): Promise<Manufacturer> {
  try {
    const response = await fetch(`${API_BASE}/manufacturers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturerData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to update manufacturer: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating manufacturer:', error)
    throw error
  }
}

export async function deleteManufacturer(id: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/manufacturers/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to delete manufacturer: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error deleting manufacturer:', error)
    throw error
  }
}

export async function searchManufacturers(query: string): Promise<Manufacturer[]> {
  try {
    const response = await fetch(`${API_BASE}/manufacturers?search=${encodeURIComponent(query)}&limit=10`)

    if (!response.ok) {
      throw new Error(`Failed to search manufacturers: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error searching manufacturers:', error)
    throw error
  }
}