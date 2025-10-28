/**
 * API响应装饰器
 */

/**
 * 标记API响应格式
 * @param description 响应描述
 * @param type 响应类型
 */
export function ApiResponse(description: string, type?: any) {
  return function (
    _target: any,
    _propertyKey: string,
    _descriptor: PropertyDescriptor
  ) {
    // 装饰器元数据，可用于Swagger文档生成
    // 这里是占位实现，实际可以扩展用于API文档生成
    console.log(`API Response: ${description}`, type);
  };
}

