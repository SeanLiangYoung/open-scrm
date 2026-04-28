<template>
  <div class="page">
    <header class="header">
      <strong>Open SCRM</strong>
      <nav>
        <a href="#features">功能亮点</a>
        <a href="#contact">联系</a>
      </nav>
    </header>
    <main>
      <section class="hero">
        <h1>企业私域与客户运营</h1>
        <p class="lead">统一消息、获客、分析与运营工作台（开发中官网骨架）。</p>
      </section>
      <section id="features" class="section">
        <h2>功能亮点</h2>
        <ul>
          <li>经网关的多微服务 API</li>
          <li>企微集成、消息幂等、分析聚合</li>
        </ul>
      </section>
      <section id="contact" class="section muted">
        <h2>联系</h2>
        <p>API 网关默认开发地址见仓库 <code>docs/facts/gateway-routes.md</code>。</p>
      </section>
    </main>
    <footer class="footer">Open SCRM · Sprint 6</footer>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, sans-serif;
  color: #0f172a;
  background: #f8fafc;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #0f172a;
  color: #f8fafc;
}
.header a {
  color: #94a3b8;
  margin-left: 1rem;
  text-decoration: none;
}
.header a:hover {
  color: #fff;
}
main {
  flex: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.25rem;
}
.hero h1 {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}
.lead {
  color: #475569;
  line-height: 1.6;
}
.section {
  margin-top: 2rem;
}
.section h2 {
  font-size: 1.125rem;
  margin-bottom: 0.75rem;
}
.section ul {
  padding-left: 1.25rem;
  color: #334155;
}
.muted {
  color: #64748b;
  font-size: 0.9375rem;
}
.footer {
  padding: 1rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #64748b;
  border-top: 1px solid #e2e8f0;
}
</style>
