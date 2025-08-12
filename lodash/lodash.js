import _ from "lodash";
const { omit, pick } = _;

export const getInfoData = ( fields = [], object = {} ) => {
  return pick(object, fields);
};

/**
 * Bỏ qua các field được chỉ định từ object
 * @param {Object} options
 * @param {Array} options.fields - Danh sách field cần loại
 * @param {Object} options.object - Object nguồn
 * @returns {Object}
 */
export const omitInfoData = ( fields = [], object = {} ) => {
  return omit(object, fields);
};