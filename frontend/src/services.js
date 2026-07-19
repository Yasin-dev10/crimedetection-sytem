import API from './api';

export const getHistory = async (page = 1, limit = 20) => {
  const response = await API.get('/history', { params: { page, limit } });
  return response.data;
};

export const getMyHistory = async (page = 1, limit = 20) => {
  const response = await API.get('/history/my', { params: { page, limit } });
  return response.data;
};

export const getStats = async () => {
  const response = await API.get('/stats');
  return response.data;
};

export const getFacebookBlacklistStats = async () => {
  const response = await API.get('/facebook/blacklist/stats');
  return response.data;
};

export const getCrimeReports = async (page = 1, limit = 50) => {
  const response = await API.get('/crime-reports', { params: { page, limit } });
  return response.data;
};

export const createCrimeReport = async (payload) => {
  const response = await API.post('/crime-reports', payload);
  return response.data;
};

export const createInvestigationCase = async (payload) => {
  const response = await API.post('/investigation/cases', payload);
  return response.data;
};

export const updateCrimeReport = async (id, payload) => {
  const response = await API.patch(`/crime-reports/${id}`, payload);
  return response.data;
};

export const deleteCrimeReport = async (id) => {
  const response = await API.delete(`/crime-reports/${id}`);
  return response.data;
};

export const exportCrimeReports = async (format) => {
  const response = await API.get('/crime-reports/export', {
    params: { format },
    responseType: 'blob',
  });
  return response.data;
};
