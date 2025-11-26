import { ApiResponse } from "../../shared/types"
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
    if (!res.ok) {
      let errorMsg = `Request failed with status ${res.status}`;
      try {
        const errorBody = await res.json();
        if (errorBody.error) {
          errorMsg = errorBody.error;
        }
      } catch (e) {
        // Not a JSON response
      }
      throw new Error(errorMsg);
    }
    const json = (await res.json()) as ApiResponse<T>;
    if (!json.success || json.data === undefined) {
      throw new Error(json.error || 'API returned a success:false response');
    }
    return json.data;
  } catch (error) {
    console.error(`API call to ${path} failed:`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
}