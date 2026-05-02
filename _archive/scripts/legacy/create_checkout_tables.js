const db = require('./db');

async function createCheckoutTables() {
  const sqlProducts = `
  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255),
    description TEXT,
    price NUMERIC,
    cover_image_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;

  const sqlOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    amount NUMERIC,
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;

  try {
    await db.run(sqlProducts);
    await db.run(sqlOrders);
    
    // Inserir um produto de teste para o Daniel
    const insertTest = `
      INSERT INTO products (workspace_id, name, description, price, cover_image_url)
      VALUES (1, 'NEXUS OS - Licença Anual', 'Acesso completo à plataforma de inteligência de tráfego e automação.', 4970.00, 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80')
      ON CONFLICT DO NOTHING;
    `;
    await db.run(insertTest).catch(()=>console.log("Produto já existe."));
    
    console.log("Checkout Tables created successfully.");
  } catch(e) {
    console.error("Error creating Checkout tables:", e.message);
  }
}

createCheckoutTables();
