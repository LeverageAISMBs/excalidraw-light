import { ApiResponse } from "../../shared/types"
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
    if (!res.ok) {
      let errorMsg = `Request failed with status ${res.status}`;
      let errorBody: any = null;
      try {
        errorBody = await res.json();
        if (errorBody && typeof errorBody === 'object' && errorBody.error && typeof errorBody.error === 'string' && errorBody.error.trim() !== '') {
          errorMsg = errorBody.error;
        } else if (res.statusText) {
          errorMsg = res.statusText;
        }
      } catch (e) {
        // Not a JSON response, or JSON parsing failed. Fallback to status text.
        if (res.statusText) {
          errorMsg = res.statusText;
        }
      }
      console.error(`API Error Details - Path: ${path}, Status: ${res.status}, Response:`, errorBody || 'No body');
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