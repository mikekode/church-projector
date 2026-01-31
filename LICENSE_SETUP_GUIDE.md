# Creenly Licensing System: Step-by-Step Setup Guide

Follow this checklist exactly to enable automated license generation and delivery.

## Part 1: Database Setup (Supabase)

1.  [ ] **Open Supabase Dashboard** for the Projector App (`ejqzexdkoqbvgmjtbbwd`).
2.  [ ] Click on **SQL Editor** (icon on the left sidebar: `>_`).
3.  [ ] Click **New Query**.
4.  [ ] **Copy** the code below:
    ```sql
    create table if not exists public.licenses (
      id uuid default gen_random_uuid() primary key,
      license_key text not null unique,
      email text not null,
      status text not null check (status in ('active', 'expired', 'cancelled', 'demo')),
      device_id text,
      current_period_end timestamp with time zone,
      created_at timestamp with time zone default now(),
      updated_at timestamp with time zone default now()
    );

    alter table public.licenses enable row level security;
    create policy "Enable read access for all users" on public.licenses for select using (true);
    ```
5.  [ ] **Paste** it into the editor and click **Run**.
    *   *Success Check: It should say "Success" or "No rows returned".*

---

## Part 2: Configuration (Environment Variables)

1.  [ ] **Get your Service Key**:
    *   In Supabase Dashboard, go to **Settings (Gear Icon) > API**.
    *   Look for the `service_role` (secret) key.
    *   **Copy** this long string.

2.  [ ] **Update Backend Config**:
    *   Open the file: `webapp/api/.env` in VS Code.
    *   Add a new line at the bottom:
        ```text
        PROJECTOR_SUPABASE_SERVICE_KEY=your_copied_key_here
        ```
    *   *Note: Replace `your_copied_key_here` with the actual key you copied.*
    *   **Save** the file.

---

## Part 3: Running the Backend

The automation lives in your `webapp/api` folder. It needs to be running to receive orders.

1.  [ ] **Start the API Server**:
    *   Open your terminal/command prompt.
    *   Navigate to your project folder.
    *   Run: `python webapp/api/main.py`
    *   *Success Check: You should see "Uvicorn running on http://0.0.0.0:8000"*

2.  [ ] **Expose to Internet** (Required for Lemon Squeezy to talk to you):
    *   Since it's running on your laptop (`localhost`), Lemon Squeezy can't reach it.
    *   **Download ngrok**: [https://ngrok.com/download](https://ngrok.com/download) (Free tool).
    *   Run: `ngrok http 8000`
    *   Copy the URL it gives you (e.g., `https://a1b2-c3d4.ngrok-free.app`).

---

## Part 4: Connect Lemon Squeezy

1.  [ ] **Go to Lemon Squeezy Dashboard**:
    *   Navigate to **Settings > Webhooks**.
    *   Click **+** (New Webhook).

2.  [ ] **Configure Webhook**:
    *   **Callback URL**: Paste your ngrok URL + `/api/webhooks/orders`
        *   Example: `https://a1b2-c3d4.ngrok-free.app/api/webhooks/orders`
    *   **Signing Secret**: (Optional/Leave blank for now)
    *   **Events**: Check the box for **Order Created**.
    *   Click **Save Webhook**.

---

## Part 5: Final Test

1.  [ ] **Simulate a Purchase**:
    *   Go to Lemon Squeezy Store (Test Mode if available).
    *   Buy your product.
    *   **Check your Terminal**: You should see:
        *   `Processing Order Event: order_created`
        *   `Generating license for: buyer@email.com`
        *   `License created: PRO-XXXX-...`
        *   `License email sent.`

2.  [ ] **Check Email**:
    *   The email you used for purchase should receive the License Key instantly!

**Note:** For production (real sales 24/7), you should deploy `webapp/api` to a cloud server (like Render, Railway, or Modal) instead of running on your laptop with ngrok.
