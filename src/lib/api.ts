export async function apiFetch<T>(url: string, config?: RequestInit) :Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    ...config,
    headers: {
      'Content-Type': 'application/json',
      ...config?.headers
    },
  });
  return await response.json();
}

export async function apiPost<T>(url:string, data: any) :Promise<T> {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
    },
    redirect: 'follow', // manual, *follow, error
    body: JSON.stringify(data) // body data type must match 'Content-Type' header
  });
  return await response.json(); // parses JSON response into native JavaScript objects
}

const group = {
  get: apiFetch,
  post: apiPost,
}

export default group;