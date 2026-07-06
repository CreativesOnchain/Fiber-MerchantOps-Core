import type { FastifyInstance } from "fastify";
import {
  FiberAdapterError,
  SimulatedFiberAdapter,
} from "@fiber-merchantops/fiber-adapter";
import type { DemoActionResponse } from "@fiber-merchantops/shared";
import type { AppContext } from "../context";
import { ApiError } from "../lib/http-errors";

type DemoAction = "mark-paid" | "mark-expired" | "mark-failed";

/**
 * Demo-only endpoints (brief §14.5) that drive the in-memory simulated adapter
 * to a terminal state, then run the same refresh path as production so the
 * intent, ledger, receipt, and webhooks all follow. They exist solely for the
 * simulated adapter; in real mode every one returns 403 demo_mode_disabled
 * (blueprint §10). Responses carry `demo_mode: true`.
 */
export function registerDemoRoutes(app: FastifyInstance, ctx: AppContext): void {
  const actions: DemoAction[] = ["mark-paid", "mark-expired", "mark-failed"];
  for (const action of actions) {
    app.post(
      `/v1/demo/payment_intents/:id/${action}`,
      async (request): Promise<DemoActionResponse> => {
        const { id } = request.params as { id: string };
        const adapter = requireSimulatedAdapter(ctx);

        const intent = await ctx.prisma.paymentIntent.findUnique({
          where: { id },
        });
        if (!intent) {
          throw ApiError.notFound(`payment intent ${id} not found`);
        }
        if (!intent.paymentHash) {
          throw ApiError.conflict(
            "invalid_state",
            "payment intent has no Fiber invoice to simulate against",
          );
        }

        driveAdapter(adapter, action, intent.paymentHash);
        const result = await ctx.statusTracker.refresh(id);

        return {
          payment_intent_id: id,
          status: result.currentStatus,
          demo_mode: true,
        };
      },
    );
  }
}

/** The demo endpoints only make sense against the simulated adapter. */
function requireSimulatedAdapter(ctx: AppContext): SimulatedFiberAdapter {
  if (
    ctx.config.FIBER_ADAPTER_MODE === "real" ||
    !(ctx.adapter instanceof SimulatedFiberAdapter)
  ) {
    throw ApiError.demoModeDisabled(
      "demo endpoints are only available when FIBER_ADAPTER_MODE=simulated",
    );
  }
  return ctx.adapter;
}

/** Apply the requested transition, mapping an illegal one to 409. */
function driveAdapter(
  adapter: SimulatedFiberAdapter,
  action: DemoAction,
  paymentHash: string,
): void {
  try {
    if (action === "mark-paid") {
      adapter.markPaid(paymentHash);
    } else if (action === "mark-expired") {
      adapter.markExpired(paymentHash);
    } else {
      adapter.markFailed(paymentHash);
    }
  } catch (error) {
    if (error instanceof FiberAdapterError) {
      throw ApiError.conflict("invalid_transition", error.message);
    }
    throw error;
  }
}
